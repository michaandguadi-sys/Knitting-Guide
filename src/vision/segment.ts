import { GrayImage, Lab, Mask, Raster, blur, fitLongSide, labDistance, rgbToLab, toGray } from './raster';

export interface SegmentResult {
  /** Mask at the resolution of the input raster. */
  mask: Mask;
  coverage: number;
  /** Bounding box of the garment in input pixels. */
  box: { x: number; y: number; width: number; height: number };
  /** True when the fabric fills the frame, as in a close-up or swatch shot. */
  fullFrame: boolean;
  confidence: number;
  backgroundLab: Lab | null;
  backgroundTextureRatio: number;
}

interface Cluster {
  center: Lab;
  count: number;
}

function kmeansLab(samples: Lab[], k: number, iterations = 12): Cluster[] {
  if (samples.length === 0) return [];
  // Deterministic farthest-point seeding: the same photo must always decode the same way.
  const centers: Lab[] = [samples[Math.floor(samples.length / 2)]];
  while (centers.length < k) {
    let best = samples[0];
    let bestD = -1;
    for (const s of samples) {
      let d = Infinity;
      for (const c of centers) d = Math.min(d, labDistance(s, c));
      if (d > bestD) {
        bestD = d;
        best = s;
      }
    }
    if (bestD < 1) break;
    centers.push(best);
  }
  let counts = new Array(centers.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    const sum = centers.map(() => ({ l: 0, a: 0, b: 0 }));
    counts = new Array(centers.length).fill(0);
    for (const s of samples) {
      let idx = 0;
      let d = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dc = labDistance(s, centers[c]);
        if (dc < d) {
          d = dc;
          idx = c;
        }
      }
      sum[idx].l += s.l;
      sum[idx].a += s.a;
      sum[idx].b += s.b;
      counts[idx]++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (counts[c] > 0) {
        centers[c] = { l: sum[c].l / counts[c], a: sum[c].a / counts[c], b: sum[c].b / counts[c] };
      }
    }
  }
  return centers.map((center, i) => ({ center, count: counts[i] }));
}

function otsu(values: Float32Array, maxValue: number): number {
  const bins = 128;
  const hist = new Float64Array(bins);
  for (let i = 0; i < values.length; i++) {
    hist[Math.min(bins - 1, Math.floor((values[i] / maxValue) * bins))]++;
  }
  let total = 0;
  let sumAll = 0;
  for (let i = 0; i < bins; i++) {
    total += hist[i];
    sumAll += i * hist[i];
  }
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let threshold = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return ((threshold + 0.5) / bins) * maxValue;
}

function morph(mask: Uint8Array, w: number, h: number, radius: number, dilate: boolean): Uint8Array {
  const pass = (src: Uint8Array, horizontal: boolean) => {
    const out = new Uint8Array(src.length);
    const lines = horizontal ? h : w;
    const len = horizontal ? w : h;
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < len; i++) {
        let hit = !dilate;
        for (let d = -radius; d <= radius; d++) {
          const j = Math.max(0, Math.min(len - 1, i + d));
          const v = horizontal ? src[l * w + j] : src[j * w + l];
          if (dilate ? v : !v) {
            hit = dilate;
            break;
          }
        }
        out[horizontal ? l * w + i : i * w + l] = hit ? 1 : 0;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

/** Keeps the largest connected blob and fills any holes inside it. */
function largestBlobFilled(mask: Uint8Array, w: number, h: number): Uint8Array {
  const labels = new Int32Array(w * h);
  const stack: number[] = [];
  let best = 0;
  let bestSize = 0;
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    let size = 0;
    stack.push(start);
    labels[start] = next;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) (labels[p - 1] = next), stack.push(p - 1);
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) (labels[p + 1] = next), stack.push(p + 1);
      if (y > 0 && mask[p - w] && !labels[p - w]) (labels[p - w] = next), stack.push(p - w);
      if (y < h - 1 && mask[p + w] && !labels[p + w]) (labels[p + w] = next), stack.push(p + w);
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
    next++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = labels[i] === best ? 1 : 0;

  // Flood the outside from the border: whatever stays unreached is a hole, e.g. a logo patch.
  const outside = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    if (outside[p] || out[p]) continue;
    outside[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  for (let i = 0; i < out.length; i++) if (!outside[i]) out[i] = 1;
  return out;
}

function fullFrameResult(width: number, height: number, confidence: number, ratio: number): SegmentResult {
  return {
    mask: { width, height, data: new Uint8Array(width * height).fill(1) },
    coverage: 1,
    box: { x: 0, y: 0, width, height },
    fullFrame: true,
    confidence,
    backgroundLab: null,
    backgroundTextureRatio: ratio,
  };
}

/** Local contrast: how much a pixel differs from its neighbourhood. Fabric is busy, tables are not. */
function textureEnergy(gray: GrayImage): Float32Array {
  const smooth = blur(gray, 2);
  const diff = new Float32Array(gray.data.length);
  for (let i = 0; i < diff.length; i++) diff[i] = Math.abs(gray.data[i] - smooth.data[i]);
  return blur({ width: gray.width, height: gray.height, data: diff }, 3).data;
}

/**
 * Separates the garment from the surface it lies on.
 *
 * The background is modelled from the frame edge and flood-filled inwards, so only surface
 * that actually connects to the edge is removed. Light yarn on a light table therefore
 * survives, which a plain colour threshold cannot do. When the edge looks like fabric the
 * photo is treated as a close-up instead of cutting away real stitches.
 */
export function segmentGarment(src: Raster): SegmentResult {
  const small = fitLongSide(src, 320);
  const w = small.width;
  const h = small.height;
  const labs: Lab[] = new Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    labs[i] = rgbToLab(small.data[p], small.data[p + 1], small.data[p + 2]);
  }
  const energy = textureEnergy(toGray(small));

  const band = Math.max(2, Math.round(Math.min(w, h) * 0.05));
  const isBorder = (x: number, y: number) => x < band || y < band || x >= w - band || y >= h - band;
  const isCentre = (x: number, y: number) =>
    x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7;

  const borderSamples: Lab[] = [];
  let centreEnergy = 0;
  let centreCount = 0;
  const centreLab = { l: 0, a: 0, b: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (isBorder(x, y)) {
        if ((x + y) % 2 === 0) borderSamples.push(labs[i]);
      } else if (isCentre(x, y)) {
        centreEnergy += energy[i];
        centreCount++;
        centreLab.l += labs[i].l;
        centreLab.a += labs[i].a;
        centreLab.b += labs[i].b;
      }
    }
  }
  centreEnergy /= Math.max(1, centreCount);
  centreLab.l /= Math.max(1, centreCount);
  centreLab.a /= Math.max(1, centreCount);
  centreLab.b /= Math.max(1, centreCount);

  // Only clusters that take up a real share of the frame edge can be "the table".
  const clusters = kmeansLab(borderSamples, 3).filter((c) => c.count > borderSamples.length * 0.12);
  const assignEnergy = new Float64Array(clusters.length);
  const assignCount = new Float64Array(clusters.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBorder(x, y)) continue;
      const i = y * w + x;
      let idx = 0;
      let d = Infinity;
      clusters.forEach((c, n) => {
        const dc = labDistance(labs[i], c.center);
        if (dc < d) {
          d = dc;
          idx = n;
        }
      });
      assignEnergy[idx] += energy[i];
      assignCount[idx]++;
    }
  }
  const dominant = clusters.reduce((a, b) => (b.count > a.count ? b : a), clusters[0]);
  const dominantIndex = clusters.indexOf(dominant);
  const domEnergy = dominant ? assignEnergy[dominantIndex] / Math.max(1, assignCount[dominantIndex]) : 0;
  const textureRatio = centreEnergy > 0 ? domEnergy / centreEnergy : 1;
  const colourGap = dominant ? labDistance(dominant.center, centreLab) : 0;

  // The edge is as busy as the centre: there is no table in this photo. Colour cannot overrule a
  // near-equal texture, because a striped close-up has edge colours unlike its average.
  if (!dominant || (textureRatio > 0.6 && colourGap < 22) || textureRatio > 0.8) {
    return fullFrameResult(src.width, src.height, 0.75, textureRatio);
  }

  // Smooth away yarn-level detail so individual stitches do not read as separate surfaces.
  const distance = new Float32Array(w * h);
  let maxD = 1;
  for (let i = 0; i < w * h; i++) {
    let d = Infinity;
    for (const c of clusters) d = Math.min(d, labDistance(labs[i], c.center));
    distance[i] = d;
    if (d > maxD) maxD = d;
  }
  const smoothDistance = blur({ width: w, height: h, data: distance }, 1.2).data;
  const threshold = Math.max(7, Math.min(28, otsu(smoothDistance, maxD)));

  const isSurface = (i: number) =>
    smoothDistance[i] < threshold && energy[i] < Math.max(centreEnergy * 0.75, domEnergy * 2 + 0.5);

  const flooded = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (flooded[p] || !isSurface(p)) continue;
    flooded[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  let fg: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < fg.length; i++) fg[i] = flooded[i] ? 0 : 1;
  const radius = Math.max(1, Math.round(Math.min(w, h) * 0.008));
  fg = morph(morph(fg, w, h, radius, false), w, h, radius, true); // open: drop specks
  fg = morph(morph(fg, w, h, radius * 2, true), w, h, radius * 2, false); // close: bridge gaps
  fg = largestBlobFilled(fg, w, h);

  let count = 0;
  for (let i = 0; i < fg.length; i++) count += fg[i];
  const coverage = count / fg.length;

  if (coverage < 0.03) {
    // Nothing separable. Keep every pixel and let the rest of the pipeline say it is unsure.
    return fullFrameResult(src.width, src.height, 0.25, textureRatio);
  }
  if (coverage > 0.93) {
    return fullFrameResult(src.width, src.height, 0.6, textureRatio);
  }

  const mask = new Uint8Array(src.width * src.height);
  let minX = src.width;
  let maxX = 0;
  let minY = src.height;
  let maxY = 0;
  const sx = w / src.width;
  const sy = h / src.height;
  for (let y = 0; y < src.height; y++) {
    const ny = Math.min(h - 1, Math.floor(y * sy));
    for (let x = 0; x < src.width; x++) {
      const nx = Math.min(w - 1, Math.floor(x * sx));
      if (fg[ny * w + nx]) {
        mask[y * src.width + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Confidence reflects how clearly surface and garment differ, not a flat optimistic number.
  const separation = Math.min(1, colourGap / 35);
  const smoothSurface = 1 - Math.min(1, textureRatio);
  const confidence = Math.max(0.3, Math.min(0.97, 0.35 + 0.35 * separation + 0.3 * smoothSurface));

  return {
    mask: { width: src.width, height: src.height, data: mask },
    coverage,
    box: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    fullFrame: false,
    confidence,
    backgroundLab: dominant.center,
    backgroundTextureRatio: textureRatio,
  };
}
