import { FabricReading, readFabric } from '../vision/pipeline';
import { Raster, crop, fitLongSide } from '../vision/raster';
import { AiImage, FetchLike, GeminiError, analyzeWithGemini } from './gemini';
import { buildQuestions, isReadyToCompile, overallConfidence, pickStitchReading, reconcile } from './reconcile';
import { AiStatus, DecodeReport, PhotoInput, PhotoSlot } from './types';

export type DecodeStage = 'clean' | 'reveal' | 'measure' | 'observe' | 'deduce' | 'done';

export interface DecodeOptions {
  apiKey?: string;
  language: 'en' | 'es';
  hints?: string;
  /** Encodes a raster as base64 JPEG. The browser passes a canvas-based one. */
  encodeJpeg: (raster: Raster) => Promise<string>;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  onStage?: (stage: DecodeStage, slot?: PhotoSlot) => void;
  /** Lets the page paint between heavy steps on a phone. */
  yieldToUi?: () => Promise<void>;
}

const SLOT_CAPTIONS: Record<PhotoSlot, string> = {
  front: 'Whole piece, colours and lighting evened out',
  closeup: 'Close-up of the fabric, colours and lighting evened out',
  inside: 'The inside of the piece',
  top: 'The top or crown of the piece',
  edge: 'An edge of the piece, to see the cast-on or bind-off',
};

function measurementSummary(readings: { slot: PhotoSlot; reading: FabricReading }[]): string {
  const lines: string[] = [];
  for (const { slot, reading } of readings) {
    const { texture, colors, segment, quality } = reading;
    const across = texture.pxPerStitch ? Math.round(segment.box.width / texture.pxPerStitch) : null;
    lines.push(
      `${slot} photo: texture reads as ${texture.family} (trust ${reading.textureConfidence.toFixed(2)}); ` +
        `about ${across ?? 'unknown'} stitches visible across the piece; ` +
        `${colors.colors.length} yarn colours (${colors.colors.map((c) => `${c.hex} ${Math.round(c.share * 100)}%`).join(', ')}) laid out as ${colors.layout}; ` +
        `photo quality ${quality.score.toFixed(2)}${quality.issues.length ? `, issues: ${quality.issues.map((i) => i.code).join(', ')}` : ''}; ` +
        `zones: ${texture.zones.map((z) => `${z.zone} ${z.family}`).join(', ') || 'none'}.`
    );
  }
  return lines.join('\n');
}

/**
 * The images the model sees: each photo cleaned, the stitch map, and sharp crops from the most
 * readable parts of the fabric at full resolution, since small stitches vanish when downscaled.
 */
export async function buildAiImages(
  readings: { slot: PhotoSlot; reading: FabricReading }[],
  encodeJpeg: DecodeOptions['encodeJpeg']
): Promise<AiImage[]> {
  const images: AiImage[] = [];
  for (const { slot, reading } of readings) {
    images.push({
      slot,
      caption: SLOT_CAPTIONS[slot],
      mimeType: 'image/jpeg',
      base64: await encodeJpeg(fitLongSide(reading.enhanced.clean, 1280)),
    });
  }
  const best = pickStitchReading(readings);
  images.push({
    slot: 'stitch_map',
    caption: 'Stitch map: the fabric in grey with lighting removed and contrast raised so the stitch structure shows regardless of yarn colour. The surface behind it is blanked out.',
    mimeType: 'image/jpeg',
    base64: await encodeJpeg(fitLongSide(best.enhanced.stitchMap, 1280)),
  });
  const { raster, texture } = best;
  const span = Math.min(640, raster.width, raster.height);
  const ranked = [...texture.tiles].sort((a, b) => b.periodicity - a.periodicity);
  const chosen: { x: number; y: number }[] = [];
  for (const tile of ranked) {
    const x = Math.max(0, Math.min(raster.width - span, tile.x));
    const y = Math.max(0, Math.min(raster.height - span, tile.y));
    if (chosen.every((c) => Math.hypot(c.x - x, c.y - y) > span * 0.6)) chosen.push({ x, y });
    if (chosen.length === 2) break;
  }
  for (const { x, y } of chosen) {
    images.push({
      slot: 'tile',
      caption: 'Sharp crop of the fabric at full resolution',
      mimeType: 'image/jpeg',
      base64: await encodeJpeg(crop(raster, x, y, span, span)),
    });
  }
  return images;
}

/**
 * The whole decode. It never invents a result: without AI the report says so, measured values
 * stay below the confirmation line, and the knitter is asked for what could not be read.
 */
export async function decodePhotos(photos: PhotoInput[], options: DecodeOptions): Promise<DecodeReport> {
  const pause = options.yieldToUi ?? (async () => {});
  const readings: { slot: PhotoSlot; reading: FabricReading }[] = [];
  for (const photo of photos) {
    options.onStage?.('clean', photo.slot);
    await pause();
    readings.push({ slot: photo.slot, reading: readFabric(photo.raster, photo.originalLongSide) });
  }
  options.onStage?.('measure');
  await pause();

  let ai: AiStatus = { state: 'no_key' };
  let deduction = null;
  if (options.apiKey) {
    try {
      const images = await buildAiImages(readings, options.encodeJpeg);
      const result = await analyzeWithGemini(images, measurementSummary(readings), options.hints, {
        apiKey: options.apiKey,
        language: options.language,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        onStage: (stage) => options.onStage?.(stage === 'observing' ? 'observe' : 'deduce'),
      });
      deduction = result.deduction;
      ai = { state: 'used', model: result.model, photosSent: images.length };
    } catch (err) {
      if (err instanceof GeminiError) {
        ai = { state: 'failed', reason: err.reason, detail: err.message };
      } else {
        ai = { state: 'failed', reason: 'network', detail: (err as Error).message };
      }
    }
  }

  const decoded = reconcile(readings, deduction, options.language);
  options.onStage?.('done');
  return {
    readings,
    decoded,
    questions: buildQuestions(decoded, options.language),
    ai,
    overallConfidence: overallConfidence(decoded),
    readyToCompile: isReadyToCompile(decoded),
  };
}

