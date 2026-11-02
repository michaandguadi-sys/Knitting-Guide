import { GrayImage, Mask, Raster, blur, createRaster, grayToRaster, rgbToLab, toGray } from './raster';

/** Removes slow lighting falloff and hat-curvature shading, leaving only yarn-scale detail. */
export function flattenIllumination(gray: GrayImage, sigma: number): GrayImage {
  const low = blur(gray, sigma);
  const out = new Float32Array(gray.data.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = gray.data[i] / Math.max(8, low.data[i]);
  }
  return { width: gray.width, height: gray.height, data: out };
}

/** Contrast-limited adaptive histogram equalisation over a tile grid, 0..255 in and out. */
export function clahe(gray: GrayImage, tiles = 8, clip = 3): GrayImage {
  const { width: w, height: h, data } = gray;
  const tw = w / tiles;
  const th = h / tiles;
  const bins = 256;
  const luts: Float32Array[] = [];
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const hist = new Float64Array(bins);
      const x0 = Math.floor(tx * tw);
      const x1 = Math.min(w, Math.floor((tx + 1) * tw));
      const y0 = Math.floor(ty * th);
      const y1 = Math.min(h, Math.floor((ty + 1) * th));
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[Math.max(0, Math.min(255, Math.round(data[y * w + x])))]++;
          n++;
        }
      }
      const limit = Math.max(1, (clip * n) / bins);
      let excess = 0;
      for (let b = 0; b < bins; b++) {
        if (hist[b] > limit) {
          excess += hist[b] - limit;
          hist[b] = limit;
        }
      }
      const add = excess / bins;
      const lut = new Float32Array(bins);
      let cum = 0;
      for (let b = 0; b < bins; b++) {
        cum += hist[b] + add;
        lut[b] = (cum / Math.max(1, n)) * 255;
      }
      luts.push(lut);
    }
  }
  const out = new Float32Array(data.length);
  for (let y = 0; y < h; y++) {
    const gy = y / th - 0.5;
    const ty0 = Math.max(0, Math.floor(gy));
    const ty1 = Math.min(tiles - 1, ty0 + 1);
    const fy = Math.max(0, Math.min(1, gy - ty0));
    for (let x = 0; x < w; x++) {
      const gx = x / tw - 0.5;
      const tx0 = Math.max(0, Math.floor(gx));
      const tx1 = Math.min(tiles - 1, tx0 + 1);
      const fx = Math.max(0, Math.min(1, gx - tx0));
      const v = Math.max(0, Math.min(255, Math.round(data[y * w + x])));
      const top = luts[ty0 * tiles + tx0][v] * (1 - fx) + luts[ty0 * tiles + tx1][v] * fx;
      const bottom = luts[ty1 * tiles + tx0][v] * (1 - fx) + luts[ty1 * tiles + tx1][v] * fx;
      out[y * w + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return { width: w, height: h, data: out };
}

export interface EnhanceResult {
  /** Colour photo with lighting evened out and colour cast removed. */
  clean: Raster;
  /** Colour-corrected but not re-lit: the reference for reading yarn colours. */
  balanced: Raster;
  /** Grey relief image where stitch structure stands out regardless of yarn colour. */
  stitchMap: Raster;
  /** Illumination-flattened luminance, input to texture measurement. */
  flat: GrayImage;
  appliedWhiteBalance: boolean;
  whitePoint: { r: number; g: number; b: number } | null;
}

/**
 * Estimates a colour cast from neutral reference pixels only: a bright, near-grey surface
 * or bright low-chroma highlights. Never from the garment's average colour, because
 * grey-world balancing would turn a green hat grey.
 */
export function estimateWhitePoint(src: Raster, mask: Mask): { r: number; g: number; b: number } | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const step = Math.max(1, Math.round(Math.sqrt((src.width * src.height) / 60000)));
  for (let y = 0; y < src.height; y += step) {
    for (let x = 0; x < src.width; x += step) {
      const i = y * src.width + x;
      if (mask.data[i]) continue;
      const p = i * 4;
      const lab = rgbToLab(src.data[p], src.data[p + 1], src.data[p + 2]);
      if (lab.l > 55 && lab.l < 98 && Math.hypot(lab.a, lab.b) < 16) {
        r += src.data[p];
        g += src.data[p + 1];
        b += src.data[p + 2];
        n++;
      }
    }
  }
  const sampled = (src.width * src.height) / (step * step);
  if (n < sampled * 0.03) return null;
  return { r: r / n, g: g / n, b: b / n };
}

/** Runs the "clean" and "reveal" stages: neutral colour, even light, visible stitches. */
export function enhance(src: Raster, mask: Mask): EnhanceResult {
  const whitePoint = estimateWhitePoint(src, mask);
  let gainR = 1;
  let gainG = 1;
  let gainB = 1;
  let applied = false;
  if (whitePoint) {
    const mean = (whitePoint.r + whitePoint.g + whitePoint.b) / 3;
    const cast = Math.max(
      Math.abs(whitePoint.r - mean),
      Math.abs(whitePoint.g - mean),
      Math.abs(whitePoint.b - mean)
    );
    if (cast > 3) {
      gainR = mean / Math.max(1, whitePoint.r);
      gainG = mean / Math.max(1, whitePoint.g);
      gainB = mean / Math.max(1, whitePoint.b);
      applied = true;
    }
  }

  const gray = toGray(src);
  const sigma = Math.max(src.width, src.height) / 14;
  const low = blur(gray, sigma);

  // Reference brightness of the garment, so even light does not change its overall level.
  let refSum = 0;
  let refN = 0;
  for (let i = 0; i < low.data.length; i += 7) {
    if (mask.data[i]) {
      refSum += low.data[i];
      refN++;
    }
  }
  const ref = refN ? refSum / refN : 128;

  const clean = createRaster(src.width, src.height);
  const balanced = createRaster(src.width, src.height);
  for (let i = 0, p = 0; i < low.data.length; i++, p += 4) {
    const shade = mask.data[i] ? Math.min(1.6, Math.max(0.65, ref / Math.max(8, low.data[i]))) : 1;
    clean.data[p] = src.data[p] * gainR * shade;
    clean.data[p + 1] = src.data[p + 1] * gainG * shade;
    clean.data[p + 2] = src.data[p + 2] * gainB * shade;
    clean.data[p + 3] = 255;
    balanced.data[p] = src.data[p] * gainR;
    balanced.data[p + 1] = src.data[p + 1] * gainG;
    balanced.data[p + 2] = src.data[p + 2] * gainB;
    balanced.data[p + 3] = 255;
  }

  const flat = flattenIllumination(gray, Math.max(6, Math.min(src.width, src.height) / 40));
  const display = new Float32Array(flat.data.length);
  for (let i = 0; i < display.length; i++) {
    display[i] = Math.max(0, Math.min(255, 128 + (flat.data[i] - 1) * 220));
  }
  const relief = clahe({ width: src.width, height: src.height, data: display }, 8, 3);

  // Unsharp mask pulls the yarn edges forward. The surface is washed out to white.
  const soft = blur(relief, 1.2);
  const sharpened = new Float32Array(relief.data.length);
  for (let i = 0; i < sharpened.length; i++) {
    const v = relief.data[i] + 0.9 * (relief.data[i] - soft.data[i]);
    sharpened[i] = mask.data[i] ? v : 245;
  }
  const stitchMap = grayToRaster({ width: src.width, height: src.height, data: sharpened });

  return { clean, balanced, stitchMap, flat, appliedWhiteBalance: applied, whitePoint };
}
