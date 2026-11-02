import { GrayImage, Mask, blur, cropGray, fft2d, halveGray } from './raster';

/** What the stitch relief looks like, before anyone names a stitch. */
export type TextureFamily =
  | 'vertical_columns' // ribbing and other column textures
  | 'horizontal_ridges' // garter and ridge textures
  | 'vee_lattice' // stockinette: stacked Vs
  | 'bump_lattice' // seed, moss, reverse stockinette: offset bumps
  | 'irregular' // cables, lace, mixed motifs: no single repeat
  | 'unresolved'; // stitches too small, blurred or fuzzy to measure

export interface TileFeatures {
  level: number;
  x: number;
  y: number;
  tiltDeg: number;
  /** Periods in pixels of the original (level 0) image. */
  periodX: number | null;
  periodY: number | null;
  /** Repeat of the averaged column profile, the rib width when the fabric has ribs. */
  columnRepeat: number | null;
  /** Autocorrelation at those periods. */
  strengthX: number;
  strengthY: number;
  /** Autocorrelation at the half-step diagonal: high when rows are offset like bricks. */
  brick: number;
  /** Share of spectral energy along the horizontal, vertical and diagonal frequency axes. */
  energyX: number;
  energyY: number;
  energyDiag: number;
  /** Variance kept by averaging down columns or across rows: persistence of lines. */
  columnPersistence: number;
  rowPersistence: number;
  /** Share of the tile in one yarn colour. Mixed tiles measure stripes, not stitches. */
  yarnPurity: number;
  periodicity: number;
  family: TextureFamily;
  scores: Record<'columns' | 'ridges' | 'vee' | 'bumps', number>;
}

export interface TextureReading {
  family: TextureFamily;
  /** 0..1 share of tile votes agreeing with `family`, weighted by how periodic each tile is. */
  agreement: number;
  periodicity: number;
  /** Width of one stitch and height of one row in pixels of the analysed image. */
  pxPerStitch: number | null;
  pxPerRow: number | null;
  /** Repeat of the column texture in stitches, e.g. 2 for 1x1 rib, 4 for 2x2. */
  ribRepeatSts: number | null;
  tiltDeg: number;
  tileCount: number;
}

export interface ZoneReading extends TextureReading {
  zone: 'top' | 'middle' | 'bottom';
}

export interface TextureReport extends TextureReading {
  zones: ZoneReading[];
  /** Spread of the measured stitch size between tiles, low on machine-knit fabric. */
  periodSpread: number | null;
  level: number;
  tiles: TileFeatures[];
}

const TILE = 128;
const MIN_PERIOD = 4;
/** Column spacing over row spacing: stockinette sits near 1.3, a 1x1 rib near 2.6. */
const RIB_MIN_ASPECT = 1.8;

function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/**
 * Evens out contrast locally, so a white pinstripe does not outweigh the green field around it,
 * and removes colour blocks that are larger than a few stitches.
 */
function normalizeLocal(tile: GrayImage): Float64Array {
  const n = tile.width;
  const low = blur(tile, n / 12);
  const hp = new Float32Array(tile.data.length);
  for (let i = 0; i < hp.length; i++) hp[i] = tile.data[i] - low.data[i];
  const sq = new Float32Array(hp.length);
  for (let i = 0; i < sq.length; i++) sq[i] = hp[i] * hp[i];
  const energy = blur({ width: n, height: n, data: sq }, n / 12);
  const out = new Float64Array(hp.length);
  for (let i = 0; i < hp.length; i++) out[i] = hp[i] / Math.sqrt(energy.data[i] + 1e-5);
  return out;
}

function powerSpectrum(values: Float64Array, n: number, window: Float64Array) {
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) re[y * n + x] = values[y * n + x] * window[x] * window[y];
  }
  fft2d(re, im, n);
  const power = new Float64Array(n * n);
  for (let i = 0; i < power.length; i++) power[i] = re[i] * re[i] + im[i] * im[i];
  return power;
}

/**
 * Knit fabric's spectrum mirrors across the fabric's own axes, whichever stitch it is, so the
 * mirror axis gives the rotation without assuming which spectral peak is strongest. A seed
 * stitch's strongest peaks are diagonal, so "rotate to the biggest peak" would misread it.
 */
function estimateTilt(power: Float64Array, n: number): number {
  const binsPerDeg = 1;
  const profile = new Float64Array(180 * binsPerDeg);
  const rMin = n / 40;
  const rMax = n / MIN_PERIOD;
  for (let y = 0; y < n; y++) {
    const fy = y < n / 2 ? y : y - n;
    for (let x = 0; x < n / 2; x++) {
      const r = Math.hypot(x, fy);
      if (r < rMin || r > rMax) continue;
      let deg = (Math.atan2(fy, x) * 180) / Math.PI;
      if (deg < 0) deg += 180;
      profile[Math.min(179, Math.floor(deg))] += Math.sqrt(power[y * n + x]);
    }
  }
  const smooth = new Float64Array(180);
  for (let i = 0; i < 180; i++) {
    for (let d = -2; d <= 2; d++) smooth[i] += profile[(i + d + 180) % 180];
  }
  let best = 0;
  let bestScore = -Infinity;
  for (let tilt = -30; tilt <= 30; tilt += 1) {
    let score = 0;
    for (let phi = 0; phi < 180; phi++) {
      const mirror = ((2 * tilt - phi) % 180 + 360) % 180;
      score += smooth[phi] * smooth[mirror];
    }
    // Ties go to the upright reading: most photos are not tilted.
    score *= 1 - Math.abs(tilt) * 0.0006;
    if (score > bestScore) {
      bestScore = score;
      best = tilt;
    }
  }
  return best;
}

function rotate(values: Float64Array, n: number, deg: number): Float64Array {
  if (Math.abs(deg) < 1.5) return values;
  const out = new Float64Array(n * n);
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const mid = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - mid;
      const dy = y - mid;
      const u = c * dx - s * dy + mid;
      const v = s * dx + c * dy + mid;
      if (u < 0 || v < 0 || u >= n - 1 || v >= n - 1) continue;
      const u0 = Math.floor(u);
      const v0 = Math.floor(v);
      const fu = u - u0;
      const fv = v - v0;
      const a = values[v0 * n + u0];
      const b = values[v0 * n + u0 + 1];
      const d = values[(v0 + 1) * n + u0];
      const e = values[(v0 + 1) * n + u0 + 1];
      out[y * n + x] = (a * (1 - fu) + b * fu) * (1 - fv) + (d * (1 - fu) + e * fu) * fv;
    }
  }
  return out;
}

/** Autocorrelation normalised for the window's overlap, so distant lags are not understated. */
function autocorrelate(power: Float64Array, n: number, window: Float64Array) {
  const re = power.slice();
  const im = new Float64Array(n * n);
  fft2d(re, im, n, true);
  const winRe = new Float64Array(n * n);
  const winIm = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) winRe[y * n + x] = window[x] * window[y];
  }
  fft2d(winRe, winIm, n);
  for (let i = 0; i < winRe.length; i++) {
    winRe[i] = winRe[i] * winRe[i] + winIm[i] * winIm[i];
    winIm[i] = 0;
  }
  fft2d(winRe, winIm, n, true);
  const zero = re[0] / Math.max(1e-9, winRe[0]);
  return (dx: number, dy: number): number => {
    const x = ((Math.round(dx) % n) + n) % n;
    const y = ((Math.round(dy) % n) + n) % n;
    const overlap = winRe[y * n + x] / Math.max(1e-9, winRe[0]);
    if (overlap < 0.2) return 0;
    return re[y * n + x] / Math.max(1e-9, winRe[y * n + x]) / Math.max(1e-9, zero);
  };
}

/** First peak that is nearly as strong as the strongest: the base period rather than a multiple. */
function findPeriod(lagValue: (d: number) => number, maxLag: number): { period: number | null; strength: number } {
  const values: number[] = [];
  for (let d = 0; d <= maxLag + 1; d++) values.push(lagValue(d));
  let strongest = 0;
  const peaks: { d: number; v: number }[] = [];
  for (let d = MIN_PERIOD; d <= maxLag; d++) {
    if (values[d] > values[d - 1] && values[d] >= values[d + 1] && values[d] > 0.04) {
      // A real peak rises above the dip before it, which rejects monotonic drift.
      let dip = values[d];
      for (let j = d - 1; j >= 1; j--) {
        if (values[j] < dip) dip = values[j];
        if (values[j] > values[d]) break;
      }
      if (values[d] - dip < 0.06) continue;
      peaks.push({ d, v: values[d] });
      if (values[d] > strongest) strongest = values[d];
    }
  }
  const first = peaks.find((p) => p.v >= strongest * 0.72);
  if (!first) return { period: null, strength: 0 };
  // Parabolic refinement gives sub-pixel periods, which matter for small stitches.
  const y0 = values[first.d - 1];
  const y1 = values[first.d];
  const y2 = values[first.d + 1];
  const denom = y0 - 2 * y1 + y2;
  const refined = denom !== 0 ? first.d + (0.5 * (y0 - y2)) / denom : first.d;
  return { period: refined, strength: first.v };
}

function analyzeTile(tile: GrayImage, level: number, x: number, y: number): TileFeatures {
  const n = tile.width;
  const window = hann(n);
  const normalized = normalizeLocal(tile);
  const tiltDeg = estimateTilt(powerSpectrum(normalized, n, window), n);
  const upright = rotate(normalized, n, tiltDeg);
  const power = powerSpectrum(upright, n, window);
  const acf = autocorrelate(power, n, window);

  const maxLag = Math.floor(n / 3);
  const horizontal = findPeriod((d) => acf(d, 0), maxLag);
  const vertical = findPeriod((d) => acf(0, d), maxLag);

  let energyX = 0;
  let energyY = 0;
  let energyDiag = 0;
  const rMin = n / 48;
  const rMax = n / MIN_PERIOD;
  for (let v = 0; v < n; v++) {
    const fy = v < n / 2 ? v : v - n;
    for (let u = 0; u < n / 2; u++) {
      const r = Math.hypot(u, fy);
      if (r < rMin || r > rMax) continue;
      const angle = Math.abs((Math.atan2(Math.abs(fy), u) * 180) / Math.PI);
      const p = Math.sqrt(power[v * n + u]);
      if (angle < 14) energyX += p;
      else if (angle > 76) energyY += p;
      else energyDiag += p;
    }
  }
  const energyTotal = Math.max(1e-9, energyX + energyY + energyDiag);
  energyX /= energyTotal;
  energyY /= energyTotal;
  energyDiag /= energyTotal;

  // Line persistence is measured on the middle of the tile, where the rotation left real data.
  const inset = Math.floor(n / 8);
  const span = n - inset * 2;
  const cols = new Float64Array(span);
  const rows = new Float64Array(span);
  let total = 0;
  for (let v = 0; v < span; v++) {
    for (let u = 0; u < span; u++) {
      const value = upright[(v + inset) * n + u + inset];
      cols[u] += value / span;
      rows[v] += value / span;
      total += (value * value) / (span * span);
    }
  }
  const variance = (values: Float64Array) => {
    let mean = 0;
    for (const value of values) mean += value / values.length;
    let acc = 0;
    for (const value of values) acc += (value - mean) ** 2 / values.length;
    return acc;
  };
  const columnPersistence = Math.min(1, variance(cols) / Math.max(1e-9, total));
  const rowPersistence = Math.min(1, variance(rows) / Math.max(1e-9, total));

  const px = horizontal.period;
  const py = vertical.period;

  // The repeat of the column profile sees through the stitch detail inside each column: on a
  // 2x2 rib the raw autocorrelation peaks at every V, the profile only at every rib.
  const profile = (lag: number) => {
    let acc = 0;
    for (let u = 0; u + lag < span; u++) acc += cols[u] * cols[u + lag];
    return acc / Math.max(1, span - lag);
  };
  const profileZero = Math.max(1e-9, profile(0));
  const columnRepeat = findPeriod((d) => profile(d) / profileZero, Math.floor(span / 2)).period;
  const brick = px && py ? acf(px / 2, py / 2) : 0;
  const halfX = px ? acf(px / 2, 0) : 0;
  const halfY = py ? acf(0, py / 2) : 0;

  const periodicity = Math.max(0, Math.max(horizontal.strength, vertical.strength));
  const columnAspect = columnRepeat && py ? columnRepeat / py : px && py ? px / py : null;

  const brickness = Math.max(0, brick - Math.max(0, halfX) * 0.7 - Math.max(0, halfY) * 0.7);
  const scores = {
    columns: columnPersistence,
    ridges: rowPersistence,
    vee: Math.min(horizontal.strength, vertical.strength),
    bumps: brickness,
  };

  // Decision order matters: line persistence is the most physical signal, so it goes first.
  // The column spacing then separates rib (2+ stitches per repeat) from stockinette, whose
  // columns are one stitch wide and also show up as lines in a close-up.
  let family: TextureFamily;
  if (periodicity < 0.1 || (px === null && py === null)) {
    family = 'unresolved';
  } else if (periodicity < 0.25) {
    family = 'irregular';
  } else if (rowPersistence > 0.22 && rowPersistence > columnPersistence * 1.6) {
    family = 'horizontal_ridges';
  } else if (columnPersistence > 0.08 && columnPersistence > rowPersistence * 1.6) {
    family = columnAspect === null || columnAspect >= RIB_MIN_ASPECT ? 'vertical_columns' : 'vee_lattice';
  } else if (brickness > 0.25) {
    family = 'bump_lattice';
  } else if (Math.min(horizontal.strength, vertical.strength) > 0.25) {
    family = 'vee_lattice';
  } else {
    family = 'irregular';
  }

  const scale = 2 ** level;
  return {
    level,
    x: x * scale,
    y: y * scale,
    tiltDeg,
    columnRepeat: columnRepeat ? columnRepeat * scale : null,
    periodX: px ? px * scale : null,
    periodY: py ? py * scale : null,
    strengthX: horizontal.strength,
    strengthY: vertical.strength,
    brick,
    energyX,
    energyY,
    energyDiag,
    columnPersistence,
    rowPersistence,
    yarnPurity: 1,
    periodicity,
    family,
    scores,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** A knit stitch is wider than a row is tall. This typical ratio only bridges missing periods. */
const STITCH_ASPECT = 1.3;

function summarize(tiles: TileFeatures[]): TextureReading {
  const empty: TextureReading = {
    family: 'unresolved',
    agreement: 0,
    periodicity: 0,
    pxPerStitch: null,
    pxPerRow: null,
    ribRepeatSts: null,
    tiltDeg: 0,
    tileCount: tiles.length,
  };
  if (tiles.length === 0) return empty;

  const votes = new Map<TextureFamily, number>();
  let voteTotal = 0;
  for (const tile of tiles) {
    const weight = Math.max(0.03, tile.periodicity);
    votes.set(tile.family, (votes.get(tile.family) || 0) + weight);
    voteTotal += weight;
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const family = ranked[0][0];
  const agreement = ranked[0][1] / Math.max(1e-9, voteTotal);

  const winners = tiles.filter((t) => t.family === family);
  const px = median(winners.flatMap((t) => (t.periodX ? [t.periodX] : [])));
  const py = median(winners.flatMap((t) => (t.periodY ? [t.periodY] : [])));

  let pxPerStitch: number | null = null;
  let pxPerRow: number | null = null;
  let ribRepeatSts: number | null = null;
  switch (family) {
    case 'vertical_columns':
      pxPerRow = py;
      pxPerStitch = py ? py * STITCH_ASPECT : null;
      {
        const repeat = median(winners.flatMap((t) => (t.columnRepeat ? [t.columnRepeat] : []))) ?? px;
        if (repeat && pxPerStitch) {
          // Column repeats are even: 1x1 is 2 sts, 2x2 is 4 sts.
          ribRepeatSts = Math.max(2, Math.round(repeat / pxPerStitch / 2) * 2);
        }
      }
      break;
    case 'horizontal_ridges':
      // One garter ridge is two rows.
      pxPerRow = py ? py / 2 : null;
      pxPerStitch = px ?? (py ? py * 0.65 * STITCH_ASPECT : null);
      break;
    case 'vee_lattice':
      pxPerStitch = px;
      pxPerRow = py;
      break;
    case 'bump_lattice':
      // The lattice repeats every two stitches and two rows when bumps alternate.
      pxPerStitch = px ? px / 2 : null;
      pxPerRow = py ? py / 2 : null;
      break;
    default:
      pxPerStitch = null;
      pxPerRow = null;
  }

  return {
    family,
    agreement,
    periodicity: winners.reduce((acc, t) => acc + t.periodicity, 0) / winners.length,
    pxPerStitch,
    pxPerRow,
    ribRepeatSts,
    tiltDeg: median(tiles.map((t) => t.tiltDeg)) ?? 0,
    tileCount: tiles.length,
  };
}

/** Per-pixel yarn index, so a tile straddling a stripe is not mistaken for a stitch texture. */
export interface YarnLabels {
  labels: Int16Array;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

function dominantShare(yarn: YarnLabels, x0: number, y0: number, size: number): number {
  const counts = new Map<number, number>();
  let n = 0;
  const stepPx = Math.max(1, Math.round(size / 16));
  for (let v = 0; v < size; v += stepPx) {
    for (let u = 0; u < size; u += stepPx) {
      n++;
      const ly = Math.floor((y0 + v) * (yarn.height / yarn.sourceHeight));
      const lx = Math.floor((x0 + u) * (yarn.width / yarn.sourceWidth));
      const label = yarn.labels[Math.min(yarn.height - 1, ly) * yarn.width + Math.min(yarn.width - 1, lx)];
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return Math.max(0, ...counts.values()) / Math.max(1, n);
}

function tilesAtLevel(gray: GrayImage, mask: Mask, level: number, yarn?: YarnLabels): TileFeatures[] {
  const out: TileFeatures[] = [];
  const size = TILE;
  if (gray.width < size || gray.height < size) return out;
  const scale = 2 ** level;
  const stepX = Math.max(size / 2, Math.floor((gray.width - size) / 6) || size / 2);
  const stepY = Math.max(size / 2, Math.floor((gray.height - size) / 6) || size / 2);
  for (let y = 0; y + size <= gray.height; y += stepY) {
    for (let x = 0; x + size <= gray.width; x += stepX) {
      let inside = 0;
      let samples = 0;
      for (let v = 0; v < size; v += 16) {
        for (let u = 0; u < size; u += 16) {
          const my = Math.min(mask.height - 1, (y + v) * scale);
          const mx = Math.min(mask.width - 1, (x + u) * scale);
          inside += mask.data[my * mask.width + mx];
          samples++;
        }
      }
      if (inside / samples < 0.92) continue;
      const features = analyzeTile(cropGray(gray, x, y, size, size), level, x, y);
      features.yarnPurity = yarn ? dominantShare(yarn, x * scale, y * scale, size * scale) : 1;
      out.push(features);
    }
  }
  return out;
}

/** Scale score: favours a resolved, strong repeat whose stitches are neither tiny nor enormous. */
function levelQuality(tiles: TileFeatures[], level: number): number {
  if (tiles.length === 0) return -1;
  const base = tiles.reduce((acc, t) => acc + t.periodicity, 0) / tiles.length;
  const periods = tiles.flatMap((t) =>
    [t.periodX, t.periodY].flatMap((p) => (p ? [p / 2 ** level] : []))
  );
  const med = median(periods);
  if (med === null) return base * 0.2;
  let fit = 1;
  // The tile holds five or more repeats only below a period of about 26px.
  if (med < 6) fit = 0.5;
  else if (med > 26) fit = 0.45;
  // A verdict from one tile is a single opinion; prefer scales that give several.
  return base * fit * Math.sqrt(Math.min(1, tiles.length / 4));
}

/**
 * Measures the stitch structure at whichever scale resolves it best and reports what it saw,
 * separately for the top, middle and bottom of the piece because a brim, body and crown are
 * often different stitches.
 */
export function analyzeTexture(flat: GrayImage, mask: Mask, yarn?: YarnLabels): TextureReport {
  const levels: { level: number; tiles: TileFeatures[]; quality: number }[] = [];
  let gray = flat;
  for (let level = 0; level < 4; level++) {
    if (gray.width < TILE || gray.height < TILE) break;
    const all = tilesAtLevel(gray, mask, level, yarn);
    const pure = all.filter((t) => t.yarnPurity >= 0.85);
    // Use single-colour tiles whenever there are enough of them to vote.
    const tiles = pure.length >= 3 ? pure : all;
    levels.push({ level, tiles, quality: levelQuality(tiles, level) });
    gray = halveGray(gray);
  }

  const usable = levels.filter((l) => l.tiles.length > 0);
  if (usable.length === 0) {
    return {
      family: 'unresolved',
      agreement: 0,
      periodicity: 0,
      pxPerStitch: null,
      pxPerRow: null,
      ribRepeatSts: null,
      tiltDeg: 0,
      tileCount: 0,
      zones: [],
      periodSpread: null,
      level: 0,
      tiles: [],
    };
  }
  let best = usable.reduce((a, b) => (b.quality > a.quality * 1.08 ? b : a));

  // A wide rib can exceed one tile: each column then reads as plain stitches. Check one level up.
  const coarser = usable.find((l) => l.level === best.level + 1);
  if (coarser && summarize(best.tiles).family === 'vee_lattice') {
    const view = summarize(coarser.tiles);
    if (view.family === 'vertical_columns' && view.agreement > 0.6 && view.periodicity > 0.5) best = coarser;
  }

  const summary = summarize(best.tiles);

  let minY = Infinity;
  let maxY = -Infinity;
  for (const tile of best.tiles) {
    minY = Math.min(minY, tile.y);
    maxY = Math.max(maxY, tile.y);
  }
  const zoneOf = (tile: TileFeatures): ZoneReading['zone'] => {
    const span = Math.max(1, maxY - minY);
    const t = (tile.y - minY) / span;
    return t < 0.34 ? 'top' : t < 0.67 ? 'middle' : 'bottom';
  };
  const zones = (['top', 'middle', 'bottom'] as const).flatMap((zone) => {
    const tiles = best.tiles.filter((t) => zoneOf(t) === zone);
    return tiles.length ? [{ ...summarize(tiles), zone }] : [];
  });

  const sizes = best.tiles.filter((t) => t.family === summary.family).flatMap((t) => (t.periodX ? [t.periodX] : []));
  let periodSpread: number | null = null;
  if (sizes.length >= 3) {
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    periodSpread = Math.sqrt(sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / sizes.length) / mean;
  }

  return { ...summary, zones, periodSpread, level: best.level, tiles: best.tiles };
}
