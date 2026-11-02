import { GrayImage, Mask, Raster, blur, rgbToLab, toGray } from './raster';

export type QualityIssueCode =
  | 'too_small'
  | 'too_dark'
  | 'too_bright'
  | 'glare'
  | 'blurry'
  | 'color_cast'
  | 'subject_too_small'
  | 'stitches_too_small'
  | 'busy_background';

export interface QualityIssue {
  code: QualityIssueCode;
  severity: 'block' | 'warn';
  /** Measured value behind the verdict, shown to the user so the check is not a black box. */
  measured: string;
}

export interface QualityReport {
  /** 0..1, how much the photo can be trusted for reading stitches. */
  score: number;
  /** False when reading stitches from this photo would be guessing. */
  usable: boolean;
  issues: QualityIssue[];
  metrics: {
    longSidePx: number;
    meanLuma: number;
    darkClipped: number;
    brightClipped: number;
    sharpness: number;
    castChroma: number | null;
    coverage: number;
    pxPerStitch: number | null;
  };
}

/** Fine detail in grey levels. Benchmark photos stay near 3 or above, even in dark or fuzzy yarn. */
const MIN_FINE_DETAIL = 0.35;
const LOW_FINE_DETAIL = 1;

/**
 * Sharpness that survives different yarn contrast: the share of local detail that is still
 * present at the finest scale. A sharp photo keeps it, a blurred one loses it first.
 */
export function measureSharpness(gray: GrayImage, mask: Mask): number {
  const fine = blur(gray, 0.8);
  const mid = blur(gray, 3);
  let fineEnergy = 0;
  let midEnergy = 0;
  let n = 0;
  for (let i = 0; i < gray.data.length; i++) {
    if (!mask.data[i]) continue;
    fineEnergy += (gray.data[i] - fine.data[i]) ** 2;
    midEnergy += (fine.data[i] - mid.data[i]) ** 2;
    n++;
  }
  // When blur removes both scales the ratio means nothing, so an all-but-empty image counts as blurred.
  const fineDetail = n ? Math.sqrt(fineEnergy / n) : 0;
  if (fineDetail < MIN_FINE_DETAIL) return 0;
  const ratio = midEnergy > 0 ? Math.sqrt(fineEnergy / midEnergy) : 0;
  // Low detail is a warning only, since a sharp photo of very dark yarn can also land here.
  return fineDetail < LOW_FINE_DETAIL ? Math.min(ratio, 0.3) : ratio;
}

export interface QualityInput {
  raster: Raster;
  mask: Mask;
  coverage: number;
  fullFrame: boolean;
  originalLongSide: number;
  pxPerStitch: number | null;
  /** Colour of neutral reference pixels when the photo has any. */
  whitePoint: { r: number; g: number; b: number } | null;
  backgroundTextureRatio: number;
}

export function assessQuality(input: QualityInput): QualityReport {
  const { raster, mask, coverage, fullFrame, originalLongSide, pxPerStitch, whitePoint } = input;
  const gray = toGray(raster);

  let sum = 0;
  let n = 0;
  let dark = 0;
  let bright = 0;
  for (let i = 0; i < gray.data.length; i++) {
    if (!mask.data[i]) continue;
    const v = gray.data[i];
    sum += v;
    n++;
    if (v < 18) dark++;
    if (v > 248) bright++;
  }
  const meanLuma = n ? sum / n : 0;
  const darkClipped = n ? dark / n : 1;
  const brightClipped = n ? bright / n : 0;
  const sharpness = measureSharpness(gray, mask);

  let castChroma: number | null = null;
  if (whitePoint) {
    const lab = rgbToLab(whitePoint.r, whitePoint.g, whitePoint.b);
    castChroma = Math.hypot(lab.a, lab.b);
  }

  const issues: QualityIssue[] = [];
  if (originalLongSide < 500) {
    issues.push({ code: 'too_small', severity: 'block', measured: `${originalLongSide}px` });
  } else if (originalLongSide < 900) {
    issues.push({ code: 'too_small', severity: 'warn', measured: `${originalLongSide}px` });
  }
  if (darkClipped > 0.35 || meanLuma < 35) {
    issues.push({
      code: 'too_dark',
      severity: darkClipped > 0.6 || meanLuma < 20 ? 'block' : 'warn',
      measured: `${Math.round(darkClipped * 100)}%`,
    });
  }
  if (brightClipped > 0.25) {
    issues.push({
      code: 'too_bright',
      severity: brightClipped > 0.5 ? 'block' : 'warn',
      measured: `${Math.round(brightClipped * 100)}%`,
    });
  } else if (brightClipped > 0.06) {
    issues.push({ code: 'glare', severity: 'warn', measured: `${Math.round(brightClipped * 100)}%` });
  }
  // Real photos from the benchmark sit between 0.7 and 1.9, so below 0.45 detail has been lost.
  if (sharpness < 0.45) {
    issues.push({ code: 'blurry', severity: sharpness < 0.2 ? 'block' : 'warn', measured: sharpness.toFixed(2) });
  }
  if (castChroma !== null && castChroma > 8) {
    issues.push({ code: 'color_cast', severity: 'warn', measured: castChroma.toFixed(0) });
  }
  if (!fullFrame && coverage < 0.12) {
    issues.push({ code: 'subject_too_small', severity: 'warn', measured: `${Math.round(coverage * 100)}%` });
  }
  if (pxPerStitch === null) {
    issues.push({ code: 'stitches_too_small', severity: 'warn', measured: '-' });
  } else if (pxPerStitch < 6) {
    issues.push({ code: 'stitches_too_small', severity: 'warn', measured: `${pxPerStitch.toFixed(1)}px` });
  }
  if (!fullFrame && input.backgroundTextureRatio > 0.8) {
    issues.push({ code: 'busy_background', severity: 'warn', measured: input.backgroundTextureRatio.toFixed(2) });
  }

  const penalty = issues.reduce((acc, issue) => acc + (issue.severity === 'block' ? 0.55 : 0.14), 0);
  const score = Math.max(0.05, Math.min(1, 1 - penalty));

  return {
    score,
    usable: !issues.some((i) => i.severity === 'block'),
    issues,
    metrics: {
      longSidePx: originalLongSide,
      meanLuma,
      darkClipped,
      brightClipped,
      sharpness,
      castChroma,
      coverage,
      pxPerStitch,
    },
  };
}
