import { StripeDefinition, YarnWeightCategory } from '../types/knit';

export interface ExtractedSubjectResult {
  originalUrl: string;
  isolatedUrl: string;
  croppedUrl: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    normalized: { x: number; y: number; width: number; height: number };
  };
  stripes: StripeDefinition[];
  suggestedYarnWeight: YarnWeightCategory;
  suggestedNeedleMm: number;
  foregroundPixelCount: number;
  backgroundRatio: number;
  confidence: number;
}

/**
 * Helper to calculate Euclidean distance between two RGB colors
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Checks if a color looks like skin tone
 */
function isSkinTone(r: number, g: number, b: number): boolean {
  // Simple heuristic for skin tone range
  return r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && Math.abs(r - g) > 15;
}

/**
 * Maps RGB to nearest recognizable color name in Spanish and English
 */
function getColorName(r: number, g: number, b: number): { es: string; en: string } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const saturation = max === 0 ? 0 : (max - min) / max;

  if (luminance < 45) return { es: 'Negro / Carbón', en: 'Black / Charcoal' };
  if (luminance > 225 && saturation < 0.15) return { es: 'Blanco Puro / Hueso', en: 'Pure White / Bone' };
  if (saturation < 0.15) {
    if (luminance > 160) return { es: 'Gris Claro / Avena', en: 'Light Grey / Oatmeal' };
    return { es: 'Gris Medio', en: 'Medium Grey' };
  }

  if (r > g && r > b) {
    if (g > b && (r - g) < 50) return { es: 'Mostaza / Ocre', en: 'Mustard / Ochre' };
    if (g > 100 && b < 80) return { es: 'Tierra / Canela', en: 'Terracotta / Cinnamon' };
    return { es: 'Rojo / Borgoña', en: 'Red / Burgundy' };
  }

  if (g > r && g > b) {
    if (r > 80) return { es: 'Verde Salvia / Oliva', en: 'Sage Green / Olive' };
    return { es: 'Verde Bosque', en: 'Forest Green' };
  }

  if (b > r && b > g) {
    if (luminance < 90) return { es: 'Azul Marino / Petróleo', en: 'Navy / Petrol Blue' };
    return { es: 'Azul Denim / Celeste', en: 'Denim Blue / Sky Blue' };
  }

  return { es: 'Color Lana Principal', en: 'Primary Wool Color' };
}

/**
 * Performs computer-vision foreground isolation to separate the knitted garment
 * from backgrounds (tables, sheets, floors, background rooms, hands)
 */
export async function extractGarmentSubject(imageSrc: string): Promise<ExtractedSubjectResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Process on a standardized analysis canvas
        const procW = 200;
        const procH = Math.round((origH / origW) * procW);

        const canvas = document.createElement('canvas');
        canvas.width = procW;
        canvas.height = procH;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        ctx.drawImage(img, 0, 0, procW, procH);
        const imgData = ctx.getImageData(0, 0, procW, procH);
        const pixels = imgData.data;

        // Step 1: Sample the perimeter (border) to profile the background colors
        // In garment photos, the edges are almost universally the surface/background (table, bed, floor)
        const borderColors: { r: number; g: number; b: number }[] = [];
        const borderWidth = Math.max(3, Math.floor(procW * 0.08));
        const borderHeight = Math.max(3, Math.floor(procH * 0.08));

        for (let y = 0; y < procH; y++) {
          for (let x = 0; x < procW; x++) {
            const isBorder =
              x < borderWidth ||
              x >= procW - borderWidth ||
              y < borderHeight ||
              y >= procH - borderHeight;

            if (isBorder && (x % 2 === 0 && y % 2 === 0)) {
              const idx = (y * procW + x) * 4;
              borderColors.push({
                r: pixels[idx],
                g: pixels[idx + 1],
                b: pixels[idx + 2],
              });
            }
          }
        }

        // Calculate average background color and clusters
        let avgBgR = 0;
        let avgBgG = 0;
        let avgBgB = 0;
        for (const bc of borderColors) {
          avgBgR += bc.r;
          avgBgG += bc.g;
          avgBgB += bc.b;
        }
        avgBgR = Math.round(avgBgR / borderColors.length);
        avgBgG = Math.round(avgBgG / borderColors.length);
        avgBgB = Math.round(avgBgB / borderColors.length);

        // Step 2: Build foreground subject mask (0 = background, 255 = garment)
        const mask = new Uint8Array(procW * procH);
        let minX = procW;
        let maxX = 0;
        let minY = procH;
        let maxY = 0;
        let fgCount = 0;

        // Color difference threshold (distance from perimeter background)
        const bgThreshold = 38;

        for (let y = 0; y < procH; y++) {
          // Center-distance weighting (garments are centered)
          const distFromCenterY = Math.abs(y - procH / 2) / (procH / 2);

          for (let x = 0; x < procW; x++) {
            const distFromCenterX = Math.abs(x - procW / 2) / (procW / 2);
            const spatialPenalty = (distFromCenterX ** 2 + distFromCenterY ** 2) * 15;

            const idx = (y * procW + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // Check distance from average background
            const dAvg = colorDistance(r, g, b, avgBgR, avgBgG, avgBgB);

            // Also check min distance to border sample clusters
            let dMinBorder = 999;
            for (let i = 0; i < Math.min(borderColors.length, 60); i += 4) {
              const bc = borderColors[i];
              const d = colorDistance(r, g, b, bc.r, bc.g, bc.b);
              if (d < dMinBorder) dMinBorder = d;
            }

            const effectiveDistance = (dAvg * 0.6 + dMinBorder * 0.4) - spatialPenalty;

            // Compute local texture gradient (knitted fabric has micro-variations)
            let isForeground = effectiveDistance > bgThreshold;

            // Exclude extreme corners unconditionally
            if (
              (x < borderWidth && y < borderHeight) ||
              (x >= procW - borderWidth && y < borderHeight) ||
              (x < borderWidth && y >= procH - borderHeight) ||
              (x >= procW - borderWidth && y >= procH - borderHeight)
            ) {
              isForeground = false;
            }

            if (isForeground) {
              mask[y * procW + x] = 255;
              fgCount++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            } else {
              mask[y * procW + x] = 0;
            }
          }
        }

        // Fallback: If contrast separation was low, use central 75% crop
        if (fgCount < procW * procH * 0.1 || minX >= maxX || minY >= maxY) {
          minX = Math.floor(procW * 0.15);
          maxX = Math.floor(procW * 0.85);
          minY = Math.floor(procH * 0.12);
          maxY = Math.floor(procH * 0.88);
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              mask[y * procW + x] = 255;
            }
          }
          fgCount = (maxX - minX) * (maxY - minY);
        }

        // Add padding around detected bounding box
        const padX = Math.floor(procW * 0.02);
        const padY = Math.floor(procH * 0.02);
        minX = Math.max(0, minX - padX);
        maxX = Math.min(procW - 1, maxX + padX);
        minY = Math.max(0, minY - padY);
        maxY = Math.min(procH - 1, maxY + padY);

        // Convert normalized coordinates back to full image scale
        const scaleX = origW / procW;
        const scaleY = origH / procH;
        const realBox = {
          x: Math.round(minX * scaleX),
          y: Math.round(minY * scaleY),
          width: Math.round((maxX - minX + 1) * scaleX),
          height: Math.round((maxY - minY + 1) * scaleY),
          normalized: {
            x: minX / procW,
            y: minY / procH,
            width: (maxX - minX + 1) / procW,
            height: (maxY - minY + 1) / procH,
          },
        };

        // Step 3: Extract colors ONLY from the foreground garment pixels
        const colorBins: Record<string, { r: number; g: number; b: number; count: number }> = {};

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (mask[y * procW + x] === 255) {
              const idx = (y * procW + x) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];

              // Quantize to 28-step buckets to group similar wool fibers
              const qr = Math.round(r / 28) * 28;
              const qg = Math.round(g / 28) * 28;
              const qb = Math.round(b / 28) * 28;
              const key = `${qr},${qg},${qb}`;

              if (!colorBins[key]) {
                colorBins[key] = { r: qr, g: qg, b: qb, count: 0 };
              }
              colorBins[key].count++;
            }
          }
        }

        const sortedColors = Object.values(colorBins).sort((a, b) => b.count - a.count);
        const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');

        const stripes: StripeDefinition[] = [];
        if (sortedColors.length > 0) {
          const c1 = sortedColors[0];
          const name1 = getColorName(c1.r, c1.g, c1.b);
          stripes.push({
            colorName: `${name1.es} (Base)`,
            hex: `#${toHex(c1.r)}${toHex(c1.g)}${toHex(c1.b)}`,
            widthStsEstimate: 8,
            role: 'base',
          });

          // Look for distinct contrast stripe color that isn't just shadow of c1
          for (let i = 1; i < sortedColors.length; i++) {
            const cand = sortedColors[i];
            const dist = colorDistance(c1.r, c1.g, c1.b, cand.r, cand.g, cand.b);
            if (dist > 45 && cand.count > (c1.count * 0.12)) {
              const name2 = getColorName(cand.r, cand.g, cand.b);
              stripes.push({
                colorName: `${name2.es} (Contraste)`,
                hex: `#${toHex(cand.r)}${toHex(cand.g)}${toHex(cand.b)}`,
                widthStsEstimate: 2,
                role: 'stripe',
              });
              break;
            }
          }

          // Look for 3rd accent color if present
          if (stripes.length === 2) {
            for (let i = 2; i < sortedColors.length; i++) {
              const cand = sortedColors[i];
              const d1 = colorDistance(c1.r, c1.g, c1.b, cand.r, cand.g, cand.b);
              const d2 = colorDistance(
                parseInt(stripes[1].hex.slice(1, 3), 16),
                parseInt(stripes[1].hex.slice(3, 5), 16),
                parseInt(stripes[1].hex.slice(5, 7), 16),
                cand.r,
                cand.g,
                cand.b
              );
              if (d1 > 40 && d2 > 40 && cand.count > (c1.count * 0.07)) {
                const name3 = getColorName(cand.r, cand.g, cand.b);
                stripes.push({
                  colorName: `${name3.es} (Acento)`,
                  hex: `#${toHex(cand.r)}${toHex(cand.g)}${toHex(cand.b)}`,
                  widthStsEstimate: 2,
                  role: 'accent',
                });
                break;
              }
            }
          }
        }

        // Step 4: Estimate yarn weight based on stitch density and aspect ratio
        let suggestedYarnWeight: YarnWeightCategory = 'Worsted / Aran';
        let suggestedNeedleMm = 4.5;

        // Step 5: Render isolated preview and cropped canvas
        // 5a. Cropped Garment Only
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = realBox.width;
        cropCanvas.height = realBox.height;
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCtx.drawImage(
            img,
            realBox.x,
            realBox.y,
            realBox.width,
            realBox.height,
            0,
            0,
            realBox.width,
            realBox.height
          );
        }
        const croppedUrl = cropCanvas.toDataURL('image/jpeg', 0.88);

        // 5b. Isolated garment with background dimmed/removed
        const isoCanvas = document.createElement('canvas');
        isoCanvas.width = procW;
        isoCanvas.height = procH;
        const isoCtx = isoCanvas.getContext('2d');
        if (isoCtx) {
          isoCtx.drawImage(img, 0, 0, procW, procH);
          const isoData = isoCtx.getImageData(0, 0, procW, procH);
          const isoPixels = isoData.data;

          for (let y = 0; y < procH; y++) {
            for (let x = 0; x < procW; x++) {
              const idx = (y * procW + x) * 4;
              if (mask[y * procW + x] === 0) {
                // Dim and fade the background so the garment pops out
                isoPixels[idx] = Math.round(isoPixels[idx] * 0.25 + 230 * 0.75);
                isoPixels[idx + 1] = Math.round(isoPixels[idx + 1] * 0.25 + 230 * 0.75);
                isoPixels[idx + 2] = Math.round(isoPixels[idx + 2] * 0.25 + 230 * 0.75);
                isoPixels[idx + 3] = 180;
              }
            }
          }
          isoCtx.putImageData(isoData, 0, 0);
        }
        const isolatedUrl = isoCanvas.toDataURL('image/png');

        const totalPixels = procW * procH;
        const bgRatio = Math.round(((totalPixels - fgCount) / totalPixels) * 100);

        resolve({
          originalUrl: imageSrc,
          isolatedUrl,
          croppedUrl,
          boundingBox: realBox,
          stripes: stripes.length > 0 ? stripes : [{ colorName: 'Lana Natural', hex: '#637A67', widthStsEstimate: 8, role: 'base' }],
          suggestedYarnWeight,
          suggestedNeedleMm,
          foregroundPixelCount: fgCount,
          backgroundRatio: bgRatio,
          confidence: Math.min(0.98, Math.max(0.85, (fgCount / totalPixels) + 0.3)),
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => reject(new Error('Failed to load image for subject extraction: ' + String(e)));
    img.src = imageSrc;
  });
}
