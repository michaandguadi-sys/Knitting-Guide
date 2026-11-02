/**
 * Pixel primitives for the vision pipeline. Nothing here touches the DOM, so every
 * stage can be unit-tested in Node against real or synthetic images.
 */

export interface Raster {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel. */
  data: Uint8ClampedArray;
}

export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

/** Binary mask, 1 = garment. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export function createRaster(width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function toGray(src: Raster): GrayImage {
  const out = new Float32Array(src.width * src.height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.299 * src.data[p] + 0.587 * src.data[p + 1] + 0.114 * src.data[p + 2];
  }
  return { width: src.width, height: src.height, data: out };
}

export function grayToRaster(src: GrayImage, lo = 0, hi = 255): Raster {
  const out = createRaster(src.width, src.height);
  const scale = 255 / Math.max(1e-6, hi - lo);
  for (let i = 0, p = 0; i < src.data.length; i++, p += 4) {
    const v = (src.data[i] - lo) * scale;
    out.data[p] = v;
    out.data[p + 1] = v;
    out.data[p + 2] = v;
    out.data[p + 3] = 255;
  }
  return out;
}

/** Area-averaging resize for downscales, nearest sampling above 1:1. */
export function resize(src: Raster, width: number, height: number): Raster {
  if (width === src.width && height === src.height) return src;
  const out = createRaster(width, height);
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.min(src.height, Math.ceil((y + 1) * sy)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.min(src.width, Math.ceil((x + 1) * sx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let v = y0; v < y1 && v < src.height; v++) {
        for (let u = x0; u < x1 && u < src.width; u++) {
          const p = (v * src.width + u) * 4;
          r += src.data[p];
          g += src.data[p + 1];
          b += src.data[p + 2];
          a += src.data[p + 3];
          n++;
        }
      }
      const q = (y * width + x) * 4;
      out.data[q] = r / n;
      out.data[q + 1] = g / n;
      out.data[q + 2] = b / n;
      out.data[q + 3] = a / n;
    }
  }
  return out;
}

export function fitLongSide(src: Raster, longSide: number): Raster {
  const long = Math.max(src.width, src.height);
  if (long <= longSide) return src;
  const k = longSide / long;
  return resize(src, Math.max(1, Math.round(src.width * k)), Math.max(1, Math.round(src.height * k)));
}

export function crop(src: Raster, x: number, y: number, w: number, h: number): Raster {
  const out = createRaster(w, h);
  for (let row = 0; row < h; row++) {
    const start = ((y + row) * src.width + x) * 4;
    out.data.set(src.data.subarray(start, start + w * 4), row * w * 4);
  }
  return out;
}

export function cropGray(src: GrayImage, x: number, y: number, w: number, h: number): GrayImage {
  const out = new Float32Array(w * h);
  for (let row = 0; row < h; row++) {
    const start = (y + row) * src.width + x;
    out.set(src.data.subarray(start, start + w), row * w);
  }
  return { width: w, height: h, data: out };
}

export function halveGray(src: GrayImage): GrayImage {
  const w = src.width >> 1;
  const h = src.height >> 1;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = y * 2 * src.width + x * 2;
      out[y * w + x] =
        (src.data[a] + src.data[a + 1] + src.data[a + src.width] + src.data[a + src.width + 1]) / 4;
    }
  }
  return { width: w, height: h, data: out };
}

function boxPass(input: Float32Array, output: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const lines = horizontal ? h : w;
  const len = horizontal ? w : h;
  const step = horizontal ? 1 : w;
  const lineStep = horizontal ? w : 1;
  const norm = 1 / (2 * r + 1);
  for (let line = 0; line < lines; line++) {
    const base = line * lineStep;
    let sum = 0;
    for (let i = -r; i <= r; i++) {
      sum += input[base + Math.min(len - 1, Math.max(0, i)) * step];
    }
    for (let i = 0; i < len; i++) {
      output[base + i * step] = sum * norm;
      const add = Math.min(len - 1, i + r + 1);
      const del = Math.max(0, i - r);
      sum += input[base + add * step] - input[base + del * step];
    }
  }
}

/** Gaussian approximated by three box passes: fast enough for phones at any sigma. */
export function blur(src: GrayImage, sigma: number): GrayImage {
  if (sigma <= 0) return { width: src.width, height: src.height, data: src.data.slice() };
  const { width: w, height: h } = src;
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  let a = src.data.slice();
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    boxPass(a, b, w, h, r, true);
    [a, b] = [b, a];
    boxPass(a, b, w, h, r, false);
    [a, b] = [b, a];
  }
  return { width: w, height: h, data: a };
}

const D65 = { x: 0.95047, y: 1, z: 1.08883 };

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const fx = labF((0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / D65.x);
  const fy = labF((0.2126 * lr + 0.7152 * lg + 0.0722 * lb) / D65.y);
  const fz = labF((0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / D65.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToRgb(lab: Lab): [number, number, number] {
  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  const inv = (t: number) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const x = inv(fx) * D65.x;
  const y = inv(fy) * D65.y;
  const z = inv(fz) * D65.z;
  return [
    linearToSrgb(3.2406 * x - 1.5372 * y - 0.4986 * z),
    linearToSrgb(-0.9689 * x + 1.8758 * y + 0.0415 * z),
    linearToSrgb(0.0557 * x - 0.204 * y + 1.057 * z),
  ];
}

export function labDistance(a: Lab, b: Lab): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

export function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** In-place iterative radix-2 FFT. `re` and `im` must have a power-of-two length. */
export function fft1d(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/** 2D FFT of a square power-of-two image, stored row-major. */
export function fft2d(re: Float64Array, im: Float64Array, n: number, inverse = false): void {
  const rowRe = new Float64Array(n);
  const rowIm = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      rowRe[x] = re[y * n + x];
      rowIm[x] = im[y * n + x];
    }
    fft1d(rowRe, rowIm, inverse);
    for (let x = 0; x < n; x++) {
      re[y * n + x] = rowRe[x];
      im[y * n + x] = rowIm[x];
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      rowRe[y] = re[y * n + x];
      rowIm[y] = im[y * n + x];
    }
    fft1d(rowRe, rowIm, inverse);
    for (let y = 0; y < n; y++) {
      re[y * n + x] = rowRe[y];
      im[y * n + x] = rowIm[y];
    }
  }
}
