import { Lab, Mask, Raster, blur, createRaster, labDistance, labToRgb, rgbToLab, toHex } from './raster';

export interface YarnColor {
  hex: string;
  lab: Lab;
  /** Share of the garment's area in this yarn, 0..1. */
  share: number;
  name: { es: string; en: string };
}

export type ColorLayout =
  | 'solid'
  | 'vertical_stripes'
  | 'horizontal_stripes'
  | 'motif' // stranded or intarsia picture, repeats in both directions
  | 'variegated' // the yarn itself changes colour in small flecks
  | 'color_block';

export interface ColorReport {
  colors: YarnColor[];
  layout: ColorLayout;
  layoutConfidence: number;
  /** Median run of the accent colours across and along the fabric, in pixels. */
  stripeWidthPx: number | null;
  stripeHeightPx: number | null;
  /** Per-pixel yarn index at `labelWidth` x `labelHeight`, -1 outside the garment. */
  labels: Int16Array;
  labelWidth: number;
  labelHeight: number;
}

const NAMED_COLORS: { es: string; en: string; rgb: [number, number, number] }[] = [
  { es: 'Blanco', en: 'White', rgb: [245, 245, 240] },
  { es: 'Crudo', en: 'Cream', rgb: [236, 228, 208] },
  { es: 'Avena', en: 'Oatmeal', rgb: [212, 200, 180] },
  { es: 'Beige', en: 'Beige', rgb: [196, 176, 148] },
  { es: 'Camel', en: 'Camel', rgb: [194, 155, 114] },
  { es: 'Marrón', en: 'Brown', rgb: [110, 76, 52] },
  { es: 'Chocolate', en: 'Chocolate', rgb: [70, 46, 34] },
  { es: 'Gris claro', en: 'Light grey', rgb: [190, 190, 188] },
  { es: 'Gris', en: 'Grey', rgb: [128, 128, 128] },
  { es: 'Gris oscuro', en: 'Charcoal', rgb: [66, 68, 72] },
  { es: 'Negro', en: 'Black', rgb: [26, 26, 28] },
  { es: 'Rojo', en: 'Red', rgb: [190, 40, 40] },
  { es: 'Borgoña', en: 'Burgundy', rgb: [110, 30, 50] },
  { es: 'Terracota', en: 'Terracotta', rgb: [184, 96, 66] },
  { es: 'Naranja', en: 'Orange', rgb: [226, 120, 40] },
  { es: 'Mostaza', en: 'Mustard', rgb: [204, 160, 44] },
  { es: 'Amarillo', en: 'Yellow', rgb: [240, 214, 70] },
  { es: 'Oliva', en: 'Olive', rgb: [88, 96, 46] },
  { es: 'Verde musgo', en: 'Moss green', rgb: [62, 82, 50] },
  { es: 'Verde salvia', en: 'Sage green', rgb: [132, 152, 128] },
  { es: 'Verde', en: 'Green', rgb: [50, 130, 80] },
  { es: 'Verde bosque', en: 'Forest green', rgb: [30, 72, 52] },
  { es: 'Verde azulado', en: 'Teal', rgb: [36, 110, 116] },
  { es: 'Celeste', en: 'Sky blue', rgb: [130, 180, 220] },
  { es: 'Azul', en: 'Blue', rgb: [50, 90, 180] },
  { es: 'Azul denim', en: 'Denim blue', rgb: [78, 104, 140] },
  { es: 'Azul marino', en: 'Navy', rgb: [28, 38, 76] },
  { es: 'Lila', en: 'Lilac', rgb: [176, 150, 200] },
  { es: 'Violeta', en: 'Purple', rgb: [96, 56, 130] },
  { es: 'Ciruela', en: 'Plum', rgb: [100, 44, 80] },
  { es: 'Rosa', en: 'Pink', rgb: [232, 160, 180] },
  { es: 'Rosa viejo', en: 'Dusty rose', rgb: [186, 130, 134] },
  { es: 'Fucsia', en: 'Magenta', rgb: [190, 40, 120] },
];

const NAMED_LABS = NAMED_COLORS.map((c) => ({ ...c, lab: rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]) }));

export function nameColor(lab: Lab): { es: string; en: string } {
  let best = NAMED_LABS[0];
  let bestD = Infinity;
  for (const entry of NAMED_LABS) {
    const d = labDistance(lab, entry.lab);
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  return { es: best.es, en: best.en };
}

interface Centroid {
  lab: Lab;
  count: number;
}

function kmeans(samples: Lab[], k: number): Centroid[] {
  const centers: Lab[] = [];
  // Farthest-point seeding from the median-lightness sample keeps runs deterministic.
  const sorted = [...samples].sort((a, b) => a.l - b.l);
  centers.push(sorted[Math.floor(sorted.length / 2)]);
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
    if (bestD < 4) break;
    centers.push(best);
  }
  const counts = new Array(centers.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    const sum = centers.map(() => ({ l: 0, a: 0, b: 0, n: 0 }));
    for (const s of samples) {
      let idx = 0;
      let d = Infinity;
      centers.forEach((c, i) => {
        const dc = labDistance(s, c);
        if (dc < d) {
          d = dc;
          idx = i;
        }
      });
      sum[idx].l += s.l;
      sum[idx].a += s.a;
      sum[idx].b += s.b;
      sum[idx].n++;
    }
    centers.forEach((_, i) => {
      counts[i] = sum[i].n;
      if (sum[i].n) centers[i] = { l: sum[i].l / sum[i].n, a: sum[i].a / sum[i].n, b: sum[i].b / sum[i].n };
    });
  }
  return centers.map((lab, i) => ({ lab, count: counts[i] }));
}

/** A shadow of the same yarn keeps its hue and only drops in lightness, so lightness counts for less. */
function yarnDistance(a: Lab, b: Lab): number {
  return Math.sqrt(0.35 * (a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Folds shades into the largest nearby yarn. Centres stay fixed while merging: averaging them
 * would let blended edge pixels chain sage, olive and white into one colour.
 */
function mergeShades(centroids: Centroid[], threshold: number): Centroid[] {
  const sorted = [...centroids].sort((a, b) => b.count - a.count);
  const kept: Centroid[] = [];
  for (const c of sorted) {
    const home = kept.find((k) => yarnDistance(k.lab, c.lab) < threshold);
    if (home) home.count += c.count;
    else kept.push({ lab: c.lab, count: c.count });
  }
  return kept;
}

function channel(src: Raster, offset: number): Float32Array {
  const out = new Float32Array(src.width * src.height);
  for (let i = 0; i < out.length; i++) out[i] = src.data[i * 4 + offset];
  return out;
}

function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Finds the yarn colours. Colours are read after blurring to about one stitch, which averages
 * away the shadows between stitches: otherwise a single green yarn looks like three greens.
 */
export function analyzeColors(src: Raster, mask: Mask, pxPerStitch: number | null): ColorReport {
  const stitch = pxPerStitch && pxPerStitch > 2 ? pxPerStitch : Math.max(src.width, src.height) / 120;
  const scale = Math.max(1, Math.round(Math.max(src.width, src.height) / 640));
  const w = Math.floor(src.width / scale);
  const h = Math.floor(src.height / scale);
  const sigma = Math.max(1, (stitch * 0.35) / scale);

  // Downsample with a plain area average, then blur in linear-ish sRGB channels.
  const small = createRaster(w, h);
  const smallMask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let m = 0;
      for (let v = 0; v < scale; v++) {
        for (let u = 0; u < scale; u++) {
          const i = (y * scale + v) * src.width + x * scale + u;
          r += src.data[i * 4];
          g += src.data[i * 4 + 1];
          b += src.data[i * 4 + 2];
          m += mask.data[i];
        }
      }
      const n = scale * scale;
      const p = (y * w + x) * 4;
      small.data[p] = r / n;
      small.data[p + 1] = g / n;
      small.data[p + 2] = b / n;
      small.data[p + 3] = 255;
      smallMask[y * w + x] = m >= n / 2 ? 1 : 0;
    }
  }
  const rb = blur({ width: w, height: h, data: channel(small, 0) }, sigma).data;
  const gb = blur({ width: w, height: h, data: channel(small, 1) }, sigma).data;
  const bb = blur({ width: w, height: h, data: channel(small, 2) }, sigma).data;

  const labs: (Lab | null)[] = new Array(w * h).fill(null);
  const samples: Lab[] = [];
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 12000)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!smallMask[i]) continue;
      const lab = rgbToLab(rb[i], gb[i], bb[i]);
      labs[i] = lab;
      if (x % step === 0 && y % step === 0) samples.push(lab);
    }
  }

  if (samples.length === 0) {
    return {
      colors: [],
      layout: 'solid',
      layoutConfidence: 0,
      stripeWidthPx: null,
      stripeHeightPx: null,
      labels: new Int16Array(w * h).fill(-1),
      labelWidth: w,
      labelHeight: h,
    };
  }

  const total = samples.length;
  const centroids = mergeShades(kmeans(samples, 8), 11)
    .filter((c) => c.count / total >= 0.015)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const labels = new Int16Array(w * h).fill(-1);
  const assign = (list: Centroid[]) => {
    for (let i = 0; i < labels.length; i++) {
      const lab = labs[i];
      if (!lab) continue;
      let idx = 0;
      let d = Infinity;
      list.forEach((c, n) => {
        const dc = yarnDistance(lab, c.lab);
        if (dc < d) {
          d = dc;
          idx = n;
        }
      });
      labels[i] = idx;
    }
  };
  assign(centroids);

  // A real second yarn runs for several stitches in at least one direction. Flecks that break up
  // within a stitch or two are shadows or tweed in one yarn, and they fold back into the base.
  const minRun = Math.max(3, (stitch * 2.5) / scale);
  const runs = centroids.map(() => ({ total: 0, count: 0, totalY: 0, countY: 0 }));
  for (let y = 0; y < h; y += 2) {
    let run = 0;
    let current = -2;
    for (let x = 0; x <= w; x++) {
      const v = x < w ? labels[y * w + x] : -3;
      if (v === current) run++;
      else {
        if (current >= 0) {
          runs[current].total += run;
          runs[current].count++;
        }
        current = v;
        run = 1;
      }
    }
  }
  for (let x = 0; x < w; x += 2) {
    let run = 0;
    let current = -2;
    for (let y = 0; y <= h; y++) {
      const v = y < h ? labels[y * w + x] : -3;
      if (v === current) run++;
      else {
        if (current >= 0) {
          runs[current].totalY += run;
          runs[current].countY++;
        }
        current = v;
        run = 1;
      }
    }
  }
  const coherent = centroids.filter((_, i) => {
    if (i === 0) return true;
    const alongX = runs[i].total / Math.max(1, runs[i].count);
    const alongY = runs[i].totalY / Math.max(1, runs[i].countY);
    return Math.max(alongX, alongY) >= minRun;
  });
  if (coherent.length !== centroids.length) assign(coherent);
  centroids.length = 0;
  centroids.push(...coherent);

  const counts = new Array(centroids.length).fill(0);
  let inside = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] >= 0) {
      counts[labels[i]]++;
      inside++;
    }
  }

  const colors: YarnColor[] = centroids.map((c, i) => {
    const [r, g, b] = labToRgb(c.lab);
    return { hex: toHex(r, g, b), lab: c.lab, share: counts[i] / Math.max(1, inside), name: nameColor(c.lab) };
  });

  // Layout: does a pixel's colour persist along the column, along the row, or neither?
  const lag = Math.max(2, Math.round((stitch * 1.5) / scale));
  let sameAlongY = 0;
  let totalY = 0;
  let sameAlongX = 0;
  let totalX = 0;
  const base = 0;
  for (let y = 0; y < h - lag; y++) {
    for (let x = 0; x < w - lag; x++) {
      const v = labels[y * w + x];
      if (v < 0 || v === base) continue;
      const below = labels[(y + lag) * w + x];
      const right = labels[y * w + x + lag];
      if (below >= 0) {
        totalY++;
        if (below === v) sameAlongY++;
      }
      if (right >= 0) {
        totalX++;
        if (right === v) sameAlongX++;
      }
    }
  }
  const pY = totalY ? sameAlongY / totalY : 0;
  const pX = totalX ? sameAlongX / totalX : 0;

  const accentShare = colors.slice(1).reduce((acc, c) => acc + c.share, 0);

  const widths: number[] = [];
  const heights: number[] = [];
  for (let y = 0; y < h; y += 3) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      const accent = labels[y * w + x] > 0;
      if (accent) run++;
      else if (run) {
        widths.push(run * scale);
        run = 0;
      }
    }
  }
  for (let x = 0; x < w; x += 3) {
    let run = 0;
    for (let y = 0; y < h; y++) {
      const accent = labels[y * w + x] > 0;
      if (accent) run++;
      else if (run) {
        heights.push(run * scale);
        run = 0;
      }
    }
  }

  let layout: ColorLayout = 'solid';
  let layoutConfidence = 0.5;
  if (colors.length <= 1 || accentShare < 0.03) {
    layout = 'solid';
    layoutConfidence = colors.length <= 1 ? 0.9 : 0.65;
  } else if (pX > 0.8 && pY > 0.8) {
    layout = 'color_block';
    layoutConfidence = 0.6;
  } else if (pY > 0.5 && pY > pX + 0.15) {
    layout = 'vertical_stripes';
    layoutConfidence = Math.min(0.95, 0.5 + (pY - pX));
  } else if (pX > 0.5 && pX > pY + 0.15) {
    layout = 'horizontal_stripes';
    layoutConfidence = Math.min(0.95, 0.5 + (pX - pY));
  } else if (pX < 0.5 && pY < 0.5) {
    layout = 'variegated';
    layoutConfidence = 0.55;
  } else {
    layout = 'motif';
    layoutConfidence = 0.55;
  }

  return {
    colors,
    layout,
    layoutConfidence,
    stripeWidthPx: medianOf(widths),
    stripeHeightPx: medianOf(heights),
    labels,
    labelWidth: w,
    labelHeight: h,
  };
}
