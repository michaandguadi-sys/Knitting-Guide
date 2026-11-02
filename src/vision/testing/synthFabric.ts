import { Raster, createRaster, fitLongSide } from '../raster';

export type SynthStitch = 'stockinette' | 'reverse_stockinette' | 'garter' | 'rib_1x1' | 'rib_2x2' | 'seed';

export interface SynthOptions {
  stitch: SynthStitch;
  width?: number;
  height?: number;
  stitchPx?: number;
  rowPx?: number;
  tiltDeg?: number;
  /** Bend of the columns in stitches across the frame, as on a round hat. */
  curve?: number;
  color?: [number, number, number];
  /** Vertical stripe colour applied to every Nth stitch column. */
  stripe?: { color: [number, number, number]; every: number; width: number };
  light?: number;
  noise?: number;
  seed?: number;
}

/** Small deterministic generator, so the benchmark gives the same numbers on every run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** A knit stitch as a V: legs meet at the bottom, toward the cast-on edge. */
function knitHeight(u: number, v: number): number {
  const left = segmentDistance(u, v, 0.12, -0.05, 0.5, 1.05);
  const right = segmentDistance(u, v, 0.88, -0.05, 0.5, 1.05);
  return Math.max(0, 1 - Math.min(left, right) / 0.2);
}

/** A purl stitch as a horizontal bump across the cell. */
function purlHeight(u: number, v: number): number {
  const arc = 0.5 + 0.18 * Math.sin((u - 0.5) * Math.PI);
  return Math.max(0, 1 - Math.abs(v - arc) / 0.34) * (0.55 + 0.45 * Math.sin(u * Math.PI));
}

function cellHeight(stitch: SynthStitch, col: number, row: number, u: number, v: number): { h: number; depth: number } {
  switch (stitch) {
    case 'stockinette':
      return { h: knitHeight(u, v), depth: 1 };
    case 'reverse_stockinette':
      return { h: purlHeight((u + (row % 2) * 0.5) % 1, v), depth: 1 };
    case 'garter':
      return row % 2 === 0
        ? { h: purlHeight((u + (Math.floor(row / 2) % 2) * 0.5) % 1, v), depth: 1 }
        : { h: knitHeight(u, v) * 0.3, depth: 0.45 };
    case 'rib_1x1':
      return col % 2 === 0 ? { h: knitHeight(u, v), depth: 1 } : { h: purlHeight(u, v) * 0.5, depth: 0.4 };
    case 'rib_2x2':
      return col % 4 < 2 ? { h: knitHeight(u, v), depth: 1 } : { h: purlHeight(u, v) * 0.5, depth: 0.4 };
    case 'seed':
      return (col + row) % 2 === 0 ? { h: knitHeight(u, v) * 0.8, depth: 0.8 } : { h: purlHeight(u, v), depth: 1 };
  }
}

/** Renders a knit surface from a stitch height field with soft directional shading. */
export function renderFabric(options: SynthOptions): Raster {
  const {
    stitch,
    width = 640,
    height = 640,
    stitchPx = 20,
    rowPx = 15,
    tiltDeg = 0,
    curve = 0,
    color = [150, 70, 60],
    stripe,
    light = 0,
    noise = 6,
    seed = 7,
  } = options;
  const random = rng(seed);
  const out = createRaster(width, height);
  const rad = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Per-stitch jitter: hand tension is never perfectly even.
  const jitter = new Float32Array(4096);
  for (let i = 0; i < jitter.length; i++) jitter[i] = random();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - width / 2;
      const dy = y - height / 2;
      let fx = cos * dx + sin * dy + width;
      const fy = -sin * dx + cos * dy + height;
      if (curve) {
        const t = (y / height - 0.5) * 2;
        fx += curve * stitchPx * t * t * Math.sign(dx) * Math.min(1, Math.abs(dx) / (width / 2));
      }
      const col = Math.floor(fx / stitchPx);
      const row = Math.floor(fy / rowPx);
      const wobble = jitter[(col * 31 + row * 17) & 4095];
      const u = fx / stitchPx - col;
      const v = fy / rowPx - row;
      const { h, depth } = cellHeight(stitch, col, row, u, v);
      const shade = (0.3 + 0.75 * Math.pow(h, 0.8)) * (0.6 + 0.4 * depth) * (0.92 + 0.16 * wobble);
      const lit = shade * (1 + light * ((x / width - 0.5) + (y / height - 0.5)));
      const n = () => (random() - 0.5) * noise;
      const base = stripe && col % stripe.every < stripe.width ? stripe.color : color;
      const p = (y * width + x) * 4;
      out.data[p] = base[0] * lit + 30 * lit + n();
      out.data[p + 1] = base[1] * lit + 30 * lit + n();
      out.data[p + 2] = base[2] * lit + 30 * lit + n();
      out.data[p + 3] = 255;
    }
  }
  return out;
}

export function downscale(src: Raster, longSide: number): Raster {
  return fitLongSide(src, longSide);
}
