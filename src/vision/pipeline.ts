import { ColorReport, analyzeColors } from './colors';
import { EnhanceResult, enhance } from './enhance';
import { QualityReport, assessQuality } from './quality';
import { Raster } from './raster';
import { SegmentResult, segmentGarment } from './segment';
import { TextureReport, analyzeTexture } from './texture';

export interface FabricReading {
  raster: Raster;
  segment: SegmentResult;
  enhanced: EnhanceResult;
  colors: ColorReport;
  texture: TextureReport;
  /** How far the measured texture can be trusted on its own, 0..1. */
  textureConfidence: number;
  quality: QualityReport;
}

/** Combines repeat strength, tile agreement and photo quality into one honest number. */
export function textureConfidenceOf(texture: TextureReport, qualityScore: number): number {
  if (texture.family === 'unresolved') return 0;
  const strength = Math.min(1, texture.periodicity / 0.7);
  const raw = 0.55 * texture.agreement + 0.45 * strength;
  const tiles = Math.min(1, texture.tileCount / 3);
  return Math.max(0, Math.min(0.9, raw * (0.5 + 0.5 * tiles) * (0.6 + 0.4 * qualityScore)));
}

/**
 * Runs clean -> reveal -> measure on one photo. The input should already be fitted to the
 * working size; `originalLongSide` keeps the resolution check honest about the source file.
 */
export function readFabric(raster: Raster, originalLongSide = Math.max(raster.width, raster.height)): FabricReading {
  const segment = segmentGarment(raster);
  const enhanced = enhance(raster, segment.mask);
  const firstPass = analyzeTexture(enhanced.flat, segment.mask);
  const colors = analyzeColors(enhanced.balanced, segment.mask, firstPass.pxPerStitch);
  // Second pass with yarn labels, so stitch measurements avoid tiles that straddle a stripe.
  const texture =
    colors.colors.length > 1
      ? analyzeTexture(enhanced.flat, segment.mask, {
          labels: colors.labels,
          width: colors.labelWidth,
          height: colors.labelHeight,
          sourceWidth: raster.width,
          sourceHeight: raster.height,
        })
      : firstPass;
  const quality = assessQuality({
    raster,
    mask: segment.mask,
    coverage: segment.coverage,
    fullFrame: segment.fullFrame,
    originalLongSide,
    pxPerStitch: texture.pxPerStitch,
    whitePoint: enhanced.whitePoint,
    backgroundTextureRatio: segment.backgroundTextureRatio,
  });
  return {
    raster,
    segment,
    enhanced,
    colors,
    texture,
    textureConfidence: textureConfidenceOf(texture, quality.score),
    quality,
  };
}
