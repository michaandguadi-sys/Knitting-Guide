import { FabricReading, readFabric } from '../vision/pipeline';
import { Raster, crop, fitLongSide } from '../vision/raster';
import { AiAnalysis, AiCallOptions, AiError, AiImage, AiRefinement, FetchLike, Observation, ProviderId, buildRefinePrompt } from './analysis';
import { analyzeWithClaude, refineWithClaude } from './claude';
import { analyzeWithGemini, refineWithGemini } from './gemini';
import { buildQuestions, isReadyToCompile, keepYourAnswers, knownFacts, overallConfidence, pickStitchReading, reconcile } from './reconcile';
import { AiStatus, DecodeReport, Decoded, PhotoFocus, PhotoInput, PhotoMark, PhotoSlot } from './types';

export type DecodeStage = 'clean' | 'reveal' | 'measure' | 'observe' | 'deduce' | 'done';

export interface DecodeOptions {
  /** AI services to try, best first. A later one only runs if the one before it fails. */
  ai?: { provider: ProviderId; apiKey: string }[];
  language: 'en' | 'es';
  hints?: string;
  /** Analyse only this part of the main picture. */
  focus?: PhotoFocus;
  /** Encodes a raster as base64 JPEG. The browser passes a canvas-based one. */
  encodeJpeg: (raster: Raster) => Promise<string>;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  onStage?: (stage: DecodeStage, slot?: PhotoSlot) => void;
  /** Each result as soon as it exists, so that the screen can show real progress. */
  onReading?: (slot: PhotoSlot, reading: FabricReading) => void;
  onObservation?: (observation: Observation) => void;
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

export function measurementSummary(readings: { slot: PhotoSlot; reading: FabricReading }[]): string {
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
  encodeJpeg: DecodeOptions['encodeJpeg'],
  context: Raster | null = null
): Promise<AiImage[]> {
  const images: AiImage[] = [];
  if (context) {
    images.push({
      slot: 'front',
      caption: 'The whole picture, only for context. The knitter wants to make just the selected part shown in the other images.',
      mimeType: 'image/jpeg',
      base64: await encodeJpeg(fitLongSide(context, 1280)),
    });
  }
  for (const { slot, reading } of readings) {
    images.push({
      slot,
      caption: context && slot === 'front' ? 'The part the knitter selected, colours and lighting evened out' : SLOT_CAPTIONS[slot],
      mimeType: 'image/jpeg',
      base64: await encodeJpeg(fitLongSide(reading.enhanced.clean, 1600)),
    });
  }
  const best = pickStitchReading(readings);
  images.push({
    slot: 'stitch_map',
    caption: 'Stitch map: the fabric in grey with lighting removed and contrast raised so the stitch structure shows regardless of yarn colour. The surface behind it is blanked out.',
    mimeType: 'image/jpeg',
    base64: await encodeJpeg(fitLongSide(best.enhanced.stitchMap, 1600)),
  });
  // One sharp crop per zone when possible, because a brim and a body are often different stitches.
  const { raster, texture } = best;
  const span = Math.min(640, raster.width, raster.height);
  const zoneOf = (y: number) => (y < raster.height / 3 ? 'top' : y < (raster.height * 2) / 3 ? 'middle' : 'bottom');
  const ranked = [...texture.tiles].sort((a, b) => b.periodicity - a.periodicity);
  const chosen: { x: number; y: number; zone: string }[] = [];
  for (const zone of ['top', 'middle', 'bottom']) {
    const tile = ranked.find((t) => zoneOf(t.y + 64 * 2 ** t.level) === zone);
    if (!tile) continue;
    const x = Math.max(0, Math.min(raster.width - span, tile.x));
    const y = Math.max(0, Math.min(raster.height - span, tile.y));
    if (chosen.every((c) => Math.hypot(c.x - x, c.y - y) > span * 0.5)) chosen.push({ x, y, zone });
  }
  for (const { x, y, zone } of chosen) {
    images.push({
      slot: 'tile',
      caption: `Sharp crop of the fabric at full resolution, from the ${zone} of the photo`,
      mimeType: 'image/jpeg',
      base64: await encodeJpeg(crop(raster, x, y, span, span)),
    });
  }
  return images;
}

export function runProvider(
  provider: ProviderId,
  images: AiImage[],
  measurements: string,
  hints: string | undefined,
  options: AiCallOptions
): Promise<AiAnalysis> {
  return provider === 'claude'
    ? analyzeWithClaude(images, measurements, hints, options)
    : analyzeWithGemini(images, measurements, hints, options);
}

/** Cuts out the selected square, or returns null when the selection is too small to read. */
export function cropToFocus(raster: Raster, focus: PhotoFocus): Raster {
  const short = Math.min(raster.width, raster.height);
  const span = Math.max(Math.min(short, 200), Math.round(short * focus.size));
  const x = Math.max(0, Math.min(raster.width - span, Math.round(focus.x * raster.width - span / 2)));
  const y = Math.max(0, Math.min(raster.height - span, Math.round(focus.y * raster.height - span / 2)));
  return crop(raster, x, y, span, span);
}

const FOCUS_HINT =
  'The knitter only wants to make the selected part of this picture. Every stitch and construction field, the title and how_to_steps must describe that part alone.';

/**
 * The whole decode. It never invents a result: without AI the report says so, measured values
 * stay below the confirmation line, and the knitter is asked for what could not be read.
 */
export async function decodePhotos(photos: PhotoInput[], options: DecodeOptions): Promise<DecodeReport> {
  const pause = options.yieldToUi ?? (async () => {});
  const readings: { slot: PhotoSlot; reading: FabricReading }[] = [];
  let context: Raster | null = null;
  for (const photo of photos) {
    options.onStage?.('clean', photo.slot);
    await pause();
    let raster = photo.raster;
    if (options.focus && photo.slot === 'front') {
      context = photo.raster;
      raster = cropToFocus(photo.raster, options.focus);
    }
    const reading = readFabric(raster, photo.originalLongSide);
    readings.push({ slot: photo.slot, reading });
    options.onReading?.(photo.slot, reading);
  }
  options.onStage?.('measure');
  await pause();

  let ai: AiStatus = { state: 'no_key' };
  let deduction = null;
  let observation = null;
  if (options.ai?.length) {
    const images = await buildAiImages(readings, options.encodeJpeg, context);
    const measurements = measurementSummary(readings);
    const hints = [context ? FOCUS_HINT : '', options.hints ?? ''].filter(Boolean).join(' ') || undefined;
    for (const service of options.ai) {
      try {
        const result = await runProvider(service.provider, images, measurements, hints, {
          apiKey: service.apiKey,
          language: options.language,
          fetchImpl: options.fetchImpl,
          sleep: options.sleep,
          onStage: (stage) => options.onStage?.(stage === 'observing' ? 'observe' : 'deduce'),
          onObservation: options.onObservation,
        });
        deduction = result.deduction;
        observation = result.observation;
        ai = { state: 'used', provider: result.provider, model: result.model, photosSent: images.length };
        break;
      } catch (err) {
        const failure = err instanceof AiError ? err : new AiError('network', (err as Error).message);
        ai = { state: 'failed', provider: service.provider, reason: failure.reason, detail: failure.message };
      }
    }
  }

  let decoded = reconcile(readings, deduction, options.language);
  // A selected part is knitted as a piece of fabric, whatever the garment around it is.
  if (context) decoded = { ...decoded, garment: { value: 'swatch', confidence: 1, source: 'you', evidence: '' } };
  options.onStage?.('done');
  return {
    readings,
    decoded,
    questions: buildQuestions(decoded, options.language),
    ai,
    aiDeduction: deduction,
    aiObservation: observation,
    context,
    overallConfidence: overallConfidence(decoded),
    readyToCompile: isReadyToCompile(decoded),
  };
}


/** A sharp crop around each tapped spot, wide enough to show about ten stitches. */
export async function buildMarkImages(reading: FabricReading, marks: PhotoMark[], encodeJpeg: DecodeOptions['encodeJpeg']): Promise<AiImage[]> {
  const { raster, texture } = reading;
  const shortSide = Math.min(raster.width, raster.height);
  const span = Math.min(shortSide, Math.max(320, Math.min(900, Math.round((texture.pxPerStitch ?? 40) * 10))));
  const images: AiImage[] = [];
  for (let i = 0; i < marks.length; i++) {
    const x = Math.max(0, Math.min(raster.width - span, Math.round(marks[i].x * raster.width - span / 2)));
    const y = Math.max(0, Math.min(raster.height - span, Math.round(marks[i].y * raster.height - span / 2)));
    images.push({
      slot: 'tile',
      caption: `Close-up of the spot the knitter tapped, mark ${i + 1}`,
      mimeType: 'image/jpeg',
      base64: await encodeJpeg(fitLongSide(crop(raster, x, y, span, span), 800)),
    });
  }
  return images;
}

export function runRefine(provider: ProviderId, images: AiImage[], prompt: string, options: AiCallOptions): Promise<AiRefinement> {
  return provider === 'claude' ? refineWithClaude(images, prompt, options) : refineWithGemini(images, prompt, options);
}

export interface RefineInput {
  note: string;
  marks: PhotoMark[];
  /** The conclusions on screen, including every answer the knitter has already given. */
  decoded: Decoded;
}

/**
 * Re-reads the piece with the knitter's correction. Answers they gave stay in force whatever comes
 * back. If every AI service fails, the current reading stays as it was and the error is thrown.
 */
export async function refineReport(report: DecodeReport, input: RefineInput, options: DecodeOptions): Promise<DecodeReport> {
  if (!options.ai?.length) throw new AiError('bad_key', 'No AI key');
  const { readings } = report;
  const front = readings.find((r) => r.slot === 'front')?.reading ?? pickStitchReading(readings);
  const images = [
    ...(await buildAiImages(readings, options.encodeJpeg, report.context)),
    ...(await buildMarkImages(front, input.marks, options.encodeJpeg)),
  ];
  const measurements = measurementSummary(readings);
  const prompt = buildRefinePrompt(
    report.aiDeduction,
    report.aiObservation,
    {
      note: input.note,
      markNotes: input.marks.map((m) => m.note),
      facts: report.context
        ? [FOCUS_HINT, ...knownFacts(input.decoded).filter((fact) => !fact.startsWith('The piece is'))]
        : knownFacts(input.decoded),
    },
    images,
    measurements,
    options.language
  );
  let failure: AiError = new AiError('no_model', 'No AI service available');
  for (const service of options.ai) {
    try {
      const result = await runRefine(service.provider, images, prompt, {
        apiKey: service.apiKey,
        language: options.language,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      });
      const decoded = keepYourAnswers(input.decoded, reconcile(readings, result.deduction, options.language));
      return {
        ...report,
        decoded,
        ai: { state: 'used', provider: result.provider, model: result.model, photosSent: images.length },
        aiDeduction: result.deduction,
        questions: buildQuestions(decoded, options.language),
        overallConfidence: overallConfidence(decoded),
        readyToCompile: isReadyToCompile(decoded),
      };
    } catch (err) {
      failure = err instanceof AiError ? err : new AiError('network', (err as Error).message);
    }
  }
  throw failure;
}
