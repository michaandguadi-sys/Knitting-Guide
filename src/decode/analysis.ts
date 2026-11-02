import { AiFailure, COLORWORK_VALUES, GARMENT_VALUES, InputKind, PhotoSlot, STITCH_VALUES, WorkDirection, WorkMethod, YARN_VALUES } from './types';
import { ColorworkType, GarmentType, MadeBy, StitchType, YarnWeightCategory } from '../types/knit';

export type ProviderId = 'claude' | 'gemini';

export class AiError extends Error {
  constructor(readonly reason: AiFailure, detail: string) {
    super(detail);
  }
}

export type FetchLike = typeof fetch;

export interface AiImage {
  slot: PhotoSlot | 'stitch_map' | 'tile';
  caption: string;
  mimeType: string;
  base64: string;
}

/** Field-by-field reading of what is visible, committed to before any conclusion is drawn. */
export interface Observation {
  input_kind: InputKind;
  is_crochet_evidence: string;
  surface_look: string;
  vs_or_bumps: string;
  visible_lines: string;
  edges: string;
  seam_or_jog: string;
  shaping: string;
  colour_changes: string;
  inside_view: string;
  scale_clues: string;
  cannot_see: string;
}

export interface Deduction {
  input_kind: InputKind;
  garment: GarmentType;
  garment_confidence: number;
  main_stitch: StitchType;
  main_stitch_confidence: number;
  main_stitch_evidence: string;
  main_stitch_lookalikes: StitchType[];
  edge_stitch: StitchType | 'same';
  edge_stitch_confidence: number;
  method: WorkMethod;
  method_confidence: number;
  method_evidence: string;
  direction: WorkDirection;
  direction_confidence: number;
  direction_evidence: string;
  folded_brim: boolean;
  folded_brim_confidence: number;
  crown_wedges: number | null;
  crown_confidence: number;
  colorwork: ColorworkType;
  colorwork_confidence: number;
  made_by: MadeBy;
  made_by_confidence: number;
  made_by_evidence: string;
  yarn_weight: YarnWeightCategory;
  needle_mm: number;
  yarn_confidence: number;
  title: string;
  features: string[];
  notes: string[];
  /** Direct answer to a knitter's correction, in one or two sentences. Empty on a first read. */
  reply_to_knitter: string;
  /** The one extra photo that would settle the biggest remaining doubt. */
  best_next_photo: NextPhoto;
  best_next_photo_reason: string;
  /** Practical written steps, for what the stitch-checked compiler cannot write. Not verified. */
  how_to_steps: string[];
}

export type NextPhoto = 'closeup' | 'inside' | 'top' | 'edge' | 'none';
const NEXT_PHOTOS: readonly NextPhoto[] = ['closeup', 'inside', 'top', 'edge', 'none'];

export const OBSERVATION_SCHEMA = {
  type: 'object',
  properties: {
    input_kind: { type: 'string', enum: ['knitted_item', 'crochet', 'woven_or_other', 'written_or_chart', 'unclear'] },
    is_crochet_evidence: { type: 'string' },
    surface_look: { type: 'string' },
    vs_or_bumps: { type: 'string' },
    visible_lines: { type: 'string' },
    edges: { type: 'string' },
    seam_or_jog: { type: 'string' },
    shaping: { type: 'string' },
    colour_changes: { type: 'string' },
    inside_view: { type: 'string' },
    scale_clues: { type: 'string' },
    cannot_see: { type: 'string' },
  },
  required: ['input_kind', 'surface_look', 'vs_or_bumps', 'visible_lines', 'edges', 'seam_or_jog', 'shaping', 'colour_changes', 'cannot_see'],
};

const confidence = { type: 'number' };

export const DEDUCTION_SCHEMA = {
  type: 'object',
  properties: {
    input_kind: { type: 'string', enum: ['knitted_item', 'crochet', 'woven_or_other', 'written_or_chart', 'unclear'] },
    garment: { type: 'string', enum: GARMENT_VALUES },
    garment_confidence: confidence,
    main_stitch: { type: 'string', enum: STITCH_VALUES },
    main_stitch_confidence: confidence,
    main_stitch_evidence: { type: 'string' },
    main_stitch_lookalikes: { type: 'array', items: { type: 'string', enum: STITCH_VALUES } },
    edge_stitch: { type: 'string', enum: [...STITCH_VALUES, 'same'] },
    edge_stitch_confidence: confidence,
    method: { type: 'string', enum: ['round', 'flat', 'unknown'] },
    method_confidence: confidence,
    method_evidence: { type: 'string' },
    direction: { type: 'string', enum: ['bottom_up', 'top_down', 'side_to_side', 'unknown'] },
    direction_confidence: confidence,
    direction_evidence: { type: 'string' },
    folded_brim: { type: 'boolean' },
    folded_brim_confidence: confidence,
    crown_wedges: { type: ['integer', 'null'] },
    crown_confidence: confidence,
    colorwork: { type: 'string', enum: COLORWORK_VALUES },
    colorwork_confidence: confidence,
    made_by: { type: 'string', enum: ['hand', 'machine', 'unknown'] },
    made_by_confidence: confidence,
    made_by_evidence: { type: 'string' },
    yarn_weight: { type: 'string', enum: YARN_VALUES },
    needle_mm: { type: 'number' },
    yarn_confidence: confidence,
    title: { type: 'string' },
    features: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } },
    reply_to_knitter: { type: 'string' },
    best_next_photo: { type: 'string', enum: ['closeup', 'inside', 'top', 'edge', 'none'] },
    best_next_photo_reason: { type: 'string' },
    how_to_steps: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'input_kind', 'garment', 'garment_confidence', 'main_stitch', 'main_stitch_confidence', 'main_stitch_evidence',
    'edge_stitch', 'method', 'method_confidence', 'method_evidence', 'direction', 'direction_confidence',
    'direction_evidence', 'folded_brim', 'colorwork', 'colorwork_confidence', 'made_by', 'made_by_confidence',
    'yarn_weight', 'needle_mm', 'yarn_confidence', 'title',
  ],
};

/** The visual rules experienced knitters use, kept out of the output so that the model must apply them. */
export const KNITTING_RULES = `Rules for reading knitted fabric.
Kind of picture:
- The knitter often has only one inspiration picture, for example from Pinterest or a shop, and not the piece itself. It may be small, filtered or styled, worn by a person, or show several items, text or a collage. Read the knitted piece that is the main subject and ignore the rest.
- Say what can be judged from this picture. When something cannot be seen, give the most common way to make such a piece, with low confidence, rather than refusing.
Stitch identity:
- Stockinette: columns of small Vs on the outside, rows of bumps on the inside. Curls at edges.
- Reverse stockinette: bumps on the outside with the Vs inside. Same fabric, opposite face.
- Garter: pronounced horizontal ridges, one ridge per two rows, same on both sides. Lies flat.
- 1x1 rib: one column of Vs, one recessed column, alternating. 2x2 rib: two and two. When stretched a rib can look like stockinette, and when relaxed the purl columns vanish, so count columns, not depth.
- Seed stitch: checkerboard of single bumps and Vs, grainy. Moss stitch: pairs of rows, blockier.
- Fisherman's rib or brioche: plump, tall columns with deep channels and stacked bumps. Much thicker than plain rib.
- Cables: raised ropes crossing over each other. Lace: deliberate holes in a pattern. Stranded colourwork: two or more colours in one row with loose strands (floats) across the inside. Intarsia: big colour blocks with no floats.
Common confusions to rule out explicitly:
- A hat turned sideways makes rib look like garter. Use the garment's opening to find which way is up.
- Crochet has chunky posts and knots that do not unravel, with no continuous interlocked columns of loops. If it is crochet, say so, since a knitting pattern cannot reproduce it.
- Printed fabric, or fleece with a knit look, has no real stitches.
Which way it was worked:
- In the round: no side seam, and a small step (jog) where horizontal stripes start and end. Rib or stockinette continues unbroken all the way around.
- Flat: a vertical seam, or for a scarf two matching selvedge edges. A stockinette tube with a seam was worked flat.
- Bottom-up hat: the crown narrows through decreases and is gathered closed at the top with a small pucker, and the brim edge is a cast-on edge.
- Top-down hat: smooth circular start at the top with lines of increases radiating out, and the brim ends in a bind-off edge: a horizontal chain along the very edge.
- Cast-on edge: a neat line of small bumps, often firmer. Bind-off edge: a row of sideways Vs like a chain.
- The Vs of stockinette point down toward the cast-on edge and open toward the working direction. Upside-down Vs relative to the garment mean it was worked in the other direction.
- Folded brim: visibly double thick with a fold line at the very bottom edge.
Machine or hand:
- Machine: extremely even tension, very fine gauge, linked seams, overlocked or cut edges, sewn crown, labels. A stitch that looks odd may be a tuck stitch (cardigan or half-cardigan). Its closest hand equivalent is fisherman's rib.
Yarn weight:
- Cannot be known without a scale. If a coin, hand or ruler is visible use it. Otherwise judge from how many stitches cross the piece, and say the confidence is low.
Confidence:
- 0.9 only if the feature is unmistakable in these photos. 0.5 means a reasonable guess. Below 0.4 means it cannot be judged from these photos. Do not inflate it: the knitter will be asked to check anything uncertain, which is better than a confident mistake.`;

export function buildObservationPrompt(images: AiImage[], measurements: string, hints: string | undefined): string {
  const list = images.map((img, i) => `Image ${i + 1}: ${img.caption}`).join('\n');
  return `You are looking at photos of a textile. First only describe what is visible. Do not name stitches or decide how it was made yet, and never guess beyond the images.

${list}

Automatic measurements from the photo, which can be wrong:
${measurements}
${hints ? `\nThe knitter says: ${hints}` : ''}

Fill every field with short concrete observations. Write "not visible" when something cannot be seen. In cannot_see list what these photos do not show that would help.`;
}

export function buildDeductionPrompt(observation: Observation, measurements: string, language: 'en' | 'es', hints: string | undefined): string {
  return `You are a master hand-knitter deciding what this piece is and how it was made, from the observations below. Apply the rules exactly.

${KNITTING_RULES}

Observations you made from the images:
${JSON.stringify(observation, null, 1)}

Automatic measurements, which can be wrong. If they disagree with what you see, trust what you see, and mention the disagreement in notes:
${measurements}
${hints ? `\nThe knitter says: ${hints}` : ''}

Write main_stitch for what defines the piece. If cables or a lace pattern are the design, main_stitch is cable or lace even when plain background covers more area, and name the background stitch in notes. Otherwise it is the stitch of the largest area. Use edge_stitch for a brim, hem or cuff that differs, otherwise "same". Each *_evidence field must point to a visible feature, in one short sentence. Use "unknown" rather than guessing for method or direction when the evidence is missing.

In how_to_steps write practical numbered-order steps a knitter can follow to make what this picture shows, one instruction per item and no numbers in the text: which needles and yarn type, the cast-on as a stitch multiple, how many rows between crossings or pattern repeats, which side is facing, and how to shape or finish it. For cables and lace give your best reading of the actual repeat, for example how many stitches cross and every how many rows. Say "estimated" where the picture cannot settle a number. Tell them to knit a swatch first.

Leave reply_to_knitter empty. In best_next_photo choose the one extra photo that would settle your biggest remaining doubt, using "none" if nothing important is uncertain, and say why in best_next_photo_reason.

Write title, evidence fields, features, notes, reasons and how_to_steps in ${language === 'es' ? 'Argentine Spanish (voseo)' : 'English'}. Never put a brand name in the title.`;
}

export function parseJsonLoose(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(stripped.slice(start, end + 1));
    throw new Error('No JSON object in response');
  }
}

const clamp01 = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value > 1 ? value / 100 : value)) : fallback;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Every field is checked against the allowed values. Anything else falls back to "unknown" with
 * zero confidence, and is never filled in from another garment.
 */
export function validateDeduction(raw: unknown): Deduction {
  if (!raw || typeof raw !== 'object') throw new AiError('invalid_response', 'Response is not an object');
  const r = raw as Record<string, unknown>;
  if (!STITCH_VALUES.includes(r.main_stitch as StitchType)) {
    throw new AiError('invalid_response', `Unknown stitch: ${String(r.main_stitch)}`);
  }
  const wedges = typeof r.crown_wedges === 'number' && r.crown_wedges >= 3 && r.crown_wedges <= 12 ? Math.round(r.crown_wedges) : null;
  const needle = typeof r.needle_mm === 'number' && r.needle_mm >= 1.5 && r.needle_mm <= 25 ? r.needle_mm : 4.5;
  return {
    input_kind: oneOf(r.input_kind, ['knitted_item', 'crochet', 'woven_or_other', 'written_or_chart', 'unclear'] as const, 'unclear'),
    garment: oneOf(r.garment, GARMENT_VALUES, 'other'),
    garment_confidence: clamp01(r.garment_confidence, 0),
    main_stitch: r.main_stitch as StitchType,
    main_stitch_confidence: clamp01(r.main_stitch_confidence, 0),
    main_stitch_evidence: text(r.main_stitch_evidence),
    main_stitch_lookalikes: Array.isArray(r.main_stitch_lookalikes)
      ? (r.main_stitch_lookalikes.filter((s) => STITCH_VALUES.includes(s as StitchType)) as StitchType[])
      : [],
    edge_stitch: oneOf(r.edge_stitch, [...STITCH_VALUES, 'same'] as const, 'same'),
    edge_stitch_confidence: clamp01(r.edge_stitch_confidence, 0),
    method: oneOf(r.method, ['round', 'flat', 'unknown'] as const, 'unknown'),
    method_confidence: clamp01(r.method_confidence, 0),
    method_evidence: text(r.method_evidence),
    direction: oneOf(r.direction, ['bottom_up', 'top_down', 'side_to_side', 'unknown'] as const, 'unknown'),
    direction_confidence: clamp01(r.direction_confidence, 0),
    direction_evidence: text(r.direction_evidence),
    folded_brim: r.folded_brim === true,
    folded_brim_confidence: clamp01(r.folded_brim_confidence, 0),
    crown_wedges: wedges,
    crown_confidence: wedges === null ? 0 : clamp01(r.crown_confidence, 0),
    colorwork: oneOf(r.colorwork, COLORWORK_VALUES, 'solid'),
    colorwork_confidence: clamp01(r.colorwork_confidence, 0),
    made_by: oneOf(r.made_by, ['hand', 'machine', 'unknown'] as const, 'unknown'),
    made_by_confidence: clamp01(r.made_by_confidence, 0),
    made_by_evidence: text(r.made_by_evidence),
    yarn_weight: oneOf(r.yarn_weight, YARN_VALUES, 'Worsted / Aran'),
    needle_mm: needle,
    yarn_confidence: clamp01(r.yarn_confidence, 0),
    title: text(r.title).slice(0, 120),
    features: Array.isArray(r.features) ? r.features.filter((f) => typeof f === 'string').slice(0, 8) : [],
    notes: Array.isArray(r.notes) ? r.notes.filter((f) => typeof f === 'string').slice(0, 8) : [],
    reply_to_knitter: text(r.reply_to_knitter),
    best_next_photo: oneOf(r.best_next_photo, NEXT_PHOTOS, 'none'),
    best_next_photo_reason: text(r.best_next_photo_reason),
    how_to_steps: Array.isArray(r.how_to_steps) ? r.how_to_steps.filter((f) => typeof f === 'string').slice(0, 14) : [],
  };
}

export function validateObservation(raw: unknown): Observation {
  if (!raw || typeof raw !== 'object') throw new AiError('invalid_response', 'Observation is not an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.surface_look !== 'string' || !r.surface_look) {
    throw new AiError('invalid_response', 'Observation has no surface description');
  }
  return {
    input_kind: oneOf(r.input_kind, ['knitted_item', 'crochet', 'woven_or_other', 'written_or_chart', 'unclear'] as const, 'unclear'),
    is_crochet_evidence: text(r.is_crochet_evidence),
    surface_look: r.surface_look,
    vs_or_bumps: text(r.vs_or_bumps),
    visible_lines: text(r.visible_lines),
    edges: text(r.edges),
    seam_or_jog: text(r.seam_or_jog),
    shaping: text(r.shaping),
    colour_changes: text(r.colour_changes),
    inside_view: text(r.inside_view),
    scale_clues: text(r.scale_clues),
    cannot_see: text(r.cannot_see),
  };
}

/** What a knitter tells the app after seeing its reading. They are holding the real piece. */
export interface KnitterCorrection {
  note: string;
  /** Notes for each spot tapped on the photo, in the order of the crops added to the images. */
  markNotes: string[];
  /** Fields the knitter has already settled. */
  facts: string[];
}

export function buildRefinePrompt(
  previous: Deduction | null,
  observation: Observation | null,
  correction: KnitterCorrection,
  images: AiImage[],
  measurements: string,
  language: 'en' | 'es'
): string {
  const list = images.map((img, i) => `Image ${i + 1}: ${img.caption}`).join('\n');
  const marks = correction.markNotes.length
    ? correction.markNotes.map((note, i) => `Mark ${i + 1}: ${note || 'no note, but they want you to look closely at this spot'}`).join('\n')
    : 'none';
  return `You are a master hand-knitter checking your reading of a knitted piece, because the knitter has responded to it. They may be holding the piece, or may have only this picture. Look at the images again.

${KNITTING_RULES}

Images:
${list}

Your earlier reading:
${previous ? JSON.stringify(previous, null, 1) : 'none: this is your first reading'}

Your earlier observations:
${observation ? JSON.stringify(observation, null, 1) : 'none'}

Automatic measurements, which can be wrong:
${measurements}

The knitter's message:
${correction.note || 'no message'}

Spots the knitter tapped on the photo, each with its own close-up image:
${marks}

What the knitter has already confirmed about the real piece:
${correction.facts.length ? correction.facts.join('\n') : 'nothing yet'}

How to respond:
- When the knitter reports something a photo cannot show, such as a seam, the inside, the thickness or who made it, accept it. They may have the piece or know its source.
- Do not simply agree. If what they say clearly contradicts what the images show, keep what the images show and say so kindly in reply_to_knitter, explaining which visible feature disagrees and how they can check it on the piece.
- Any tapped spot may show something your earlier reading missed, such as a different stitch on a brim. Re-examine it before deciding.
- Update every field the new information affects, not only the one mentioned. Keep the other fields as they were, with honest confidence.
- In reply_to_knitter answer them directly in one or two sentences: what you changed and why, or why you did not change it.
In how_to_steps write practical numbered-order steps a knitter can follow to make what this picture shows, one instruction per item and no numbers in the text: which needles and yarn type, the cast-on as a stitch multiple, how many rows between crossings or pattern repeats, which side is facing, and how to shape or finish it. For cables and lace give your best reading of the actual repeat, for example how many stitches cross and every how many rows. Say "estimated" where the picture cannot settle a number. Tell them to knit a swatch first.
- In best_next_photo choose the one extra photo that would settle your biggest remaining doubt, using "none" if nothing important is uncertain, and say why in best_next_photo_reason.

Write title, evidence fields, features, notes, reasons, how_to_steps and reply_to_knitter in ${language === 'es' ? 'Argentine Spanish (voseo)' : 'English'}. If the knitter wrote in another language, write reply_to_knitter in their language. Never put a brand name in the title.`;
}

/** Everything a provider must do: send images and a prompt, and return the parsed JSON answer. */
export type GenerateJson = (prompt: string, schema: JsonSchema) => Promise<unknown>;
export type JsonSchema = Record<string, unknown>;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface AiAnalysis {
  provider: ProviderId;
  model: string;
  observation: Observation;
  deduction: Deduction;
  usage: TokenUsage;
}

export interface AiCallOptions {
  apiKey: string;
  language: 'en' | 'es';
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  onStage?: (stage: 'observing' | 'deducing') => void;
  /** Overrides the provider's default model. */
  model?: string;
}

/**
 * Two separate calls on purpose. The model first commits to what it sees and only then reasons
 * from that record, which stops it fitting its description to a stitch it guessed at first.
 * Images stay attached to the second call so that it can double-check its own notes.
 */
export async function observeThenDeduce(
  generate: GenerateJson,
  images: AiImage[],
  measurements: string,
  hints: string | undefined,
  options: Pick<AiCallOptions, 'language' | 'onStage'>
): Promise<{ observation: Observation; deduction: Deduction }> {
  options.onStage?.('observing');
  const observation = validateObservation(await generate(buildObservationPrompt(images, measurements, hints), OBSERVATION_SCHEMA));
  options.onStage?.('deducing');
  const deduction = validateDeduction(await generate(buildDeductionPrompt(observation, measurements, options.language, hints), DEDUCTION_SCHEMA));
  return { observation, deduction };
}

export interface AiRefinement {
  provider: ProviderId;
  model: string;
  deduction: Deduction;
  usage: TokenUsage;
}

export interface KeyCheck {
  valid: boolean;
  reason?: AiFailure;
  detail: string;
  model?: string;
}
