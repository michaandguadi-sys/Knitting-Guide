import { AiFailure, COLORWORK_VALUES, GARMENT_VALUES, InputKind, PhotoSlot, STITCH_VALUES, WorkDirection, WorkMethod, YARN_VALUES } from './types';
import { ColorworkType, GarmentType, MadeBy, StitchType, YarnWeightCategory } from '../types/knit';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Tried in order when the account's model list cannot be read. */
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

export class GeminiError extends Error {
  constructor(readonly reason: AiFailure, detail: string) {
    super(detail);
  }
}

export interface AiImage {
  slot: PhotoSlot | 'stitch_map' | 'tile';
  caption: string;
  mimeType: string;
  base64: string;
}

export type FetchLike = typeof fetch;

export interface GeminiOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  language: 'en' | 'es';
  onStage?: (stage: 'observing' | 'deducing') => void;
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
}

const OBSERVATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    input_kind: { type: 'STRING', enum: ['knitted_item', 'crochet', 'woven_or_other', 'written_or_chart', 'unclear'] },
    is_crochet_evidence: { type: 'STRING' },
    surface_look: { type: 'STRING' },
    vs_or_bumps: { type: 'STRING' },
    visible_lines: { type: 'STRING' },
    edges: { type: 'STRING' },
    seam_or_jog: { type: 'STRING' },
    shaping: { type: 'STRING' },
    colour_changes: { type: 'STRING' },
    inside_view: { type: 'STRING' },
    scale_clues: { type: 'STRING' },
    cannot_see: { type: 'STRING' },
  },
  required: ['input_kind', 'surface_look', 'vs_or_bumps', 'visible_lines', 'edges', 'seam_or_jog', 'shaping', 'colour_changes', 'cannot_see'],
};

const confidence = { type: 'NUMBER' };

const DEDUCTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    input_kind: { type: 'STRING', enum: ['knitted_item', 'crochet', 'woven_or_other', 'written_or_chart', 'unclear'] },
    garment: { type: 'STRING', enum: GARMENT_VALUES },
    garment_confidence: confidence,
    main_stitch: { type: 'STRING', enum: STITCH_VALUES },
    main_stitch_confidence: confidence,
    main_stitch_evidence: { type: 'STRING' },
    main_stitch_lookalikes: { type: 'ARRAY', items: { type: 'STRING', enum: STITCH_VALUES } },
    edge_stitch: { type: 'STRING', enum: [...STITCH_VALUES, 'same'] },
    edge_stitch_confidence: confidence,
    method: { type: 'STRING', enum: ['round', 'flat', 'unknown'] },
    method_confidence: confidence,
    method_evidence: { type: 'STRING' },
    direction: { type: 'STRING', enum: ['bottom_up', 'top_down', 'side_to_side', 'unknown'] },
    direction_confidence: confidence,
    direction_evidence: { type: 'STRING' },
    folded_brim: { type: 'BOOLEAN' },
    folded_brim_confidence: confidence,
    crown_wedges: { type: 'INTEGER', nullable: true },
    crown_confidence: confidence,
    colorwork: { type: 'STRING', enum: COLORWORK_VALUES },
    colorwork_confidence: confidence,
    made_by: { type: 'STRING', enum: ['hand', 'machine', 'unknown'] },
    made_by_confidence: confidence,
    made_by_evidence: { type: 'STRING' },
    yarn_weight: { type: 'STRING', enum: YARN_VALUES },
    needle_mm: { type: 'NUMBER' },
    yarn_confidence: confidence,
    title: { type: 'STRING' },
    features: { type: 'ARRAY', items: { type: 'STRING' } },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
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

Write main_stitch for the largest area of the piece. Use edge_stitch for a brim, hem or cuff that differs, otherwise "same". Each *_evidence field must point to a visible feature, in one short sentence. Use "unknown" rather than guessing for method or direction when the evidence is missing.

Write title, evidence fields, features and notes in ${language === 'es' ? 'Argentine Spanish (voseo)' : 'English'}. Never put a brand name in the title.`;
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
  if (!raw || typeof raw !== 'object') throw new GeminiError('invalid_response', 'Response is not an object');
  const r = raw as Record<string, unknown>;
  if (!STITCH_VALUES.includes(r.main_stitch as StitchType)) {
    throw new GeminiError('invalid_response', `Unknown stitch: ${String(r.main_stitch)}`);
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
  };
}

function validateObservation(raw: unknown): Observation {
  if (!raw || typeof raw !== 'object') throw new GeminiError('invalid_response', 'Observation is not an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.surface_look !== 'string' || !r.surface_look) {
    throw new GeminiError('invalid_response', 'Observation has no surface description');
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

function classifyHttp(status: number, message: string): GeminiError {
  if (status === 400 && /api key/i.test(message)) return new GeminiError('bad_key', message);
  if (status === 401 || status === 403) return new GeminiError('bad_key', message);
  if (status === 429) return new GeminiError('quota', message);
  if (status === 404) return new GeminiError('no_model', message);
  return new GeminiError('network', `HTTP ${status}: ${message}`);
}

interface CallContext {
  fetchImpl: FetchLike;
  apiKey: string;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
}

async function fetchWithTimeout(ctx: CallContext, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
  try {
    return await ctx.fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new GeminiError('timeout', 'The request took too long');
    throw new GeminiError('network', (err as Error).message || 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

/** Calls one model, retrying what can recover: rate limits, overloads and malformed answers. */
async function generate(ctx: CallContext, model: string, parts: unknown[], schema: unknown): Promise<unknown> {
  let lastError: GeminiError = new GeminiError('network', 'No attempt made');
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await ctx.sleep(1500 * 2 ** (attempt - 1));
    let response: Response;
    try {
      response = await fetchWithTimeout(ctx, `${API_BASE}/models/${model}:generateContent`, {
        method: 'POST',
        // The header keeps the key out of URLs, browser history and server logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ctx.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        }),
      });
    } catch (err) {
      lastError = err as GeminiError;
      continue;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body?.error?.message || `HTTP ${response.status}`;
      const failure = classifyHttp(response.status, message);
      if (failure.reason === 'bad_key' || failure.reason === 'no_model') throw failure;
      lastError = failure;
      continue;
    }
    const data = await response.json().catch(() => null);
    const candidate = data?.candidates?.[0];
    if (data?.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
      throw new GeminiError('blocked', data?.promptFeedback?.blockReason || 'Blocked by safety filter');
    }
    const content: string | undefined = candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('');
    if (!content) {
      lastError = new GeminiError('invalid_response', 'Empty response');
      continue;
    }
    try {
      return parseJsonLoose(content);
    } catch (err) {
      lastError = new GeminiError('invalid_response', (err as Error).message);
    }
  }
  throw lastError;
}

function versionOf(name: string): number {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Asks the account which models exist, because a hardcoded model name stops working the day
 * Google retires it. Prefers the newest stable flash model that takes images.
 */
export async function chooseModels(ctx: CallContext): Promise<string[]> {
  try {
    const response = await fetchWithTimeout(ctx, `${API_BASE}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': ctx.apiKey },
    });
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => ({}));
      throw classifyHttp(response.status === 400 ? 403 : response.status, body?.error?.message || 'Key rejected');
    }
    if (!response.ok) return FALLBACK_MODELS;
    const data = await response.json();
    const usable: string[] = (data?.models || [])
      .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: { name: string }) => m.name.replace(/^models\//, ''))
      .filter((n: string) => /^gemini-\d/.test(n) && /flash/.test(n))
      .filter((n: string) => !/(lite|image|tts|audio|live|preview|exp|thinking|embedding)/.test(n));
    const ranked = [...usable].sort((a, b) => versionOf(b) - versionOf(a) || a.length - b.length);
    return ranked.length ? ranked.slice(0, 3) : FALLBACK_MODELS;
  } catch (err) {
    if (err instanceof GeminiError && err.reason === 'bad_key') throw err;
    return FALLBACK_MODELS;
  }
}

export interface GeminiResult {
  model: string;
  observation: Observation;
  deduction: Deduction;
}

/**
 * Two separate calls on purpose. The model first commits to what it sees and only then reasons
 * from that record, which stops it fitting its description to a stitch it guessed at first.
 */
export async function analyzeWithGemini(
  images: AiImage[],
  measurements: string,
  hints: string | undefined,
  options: GeminiOptions
): Promise<GeminiResult> {
  const ctx: CallContext = {
    fetchImpl: options.fetchImpl ?? ((...args) => fetch(...args)),
    apiKey: options.apiKey,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    timeoutMs: options.timeoutMs ?? 90000,
  };
  const models = await chooseModels(ctx);

  const imageParts = images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
  let lastError: GeminiError = new GeminiError('no_model', 'No model available');
  for (const model of models) {
    try {
      options.onStage?.('observing');
      const observation = validateObservation(
        await generate(ctx, model, [...imageParts, { text: buildObservationPrompt(images, measurements, hints) }], OBSERVATION_SCHEMA)
      );
      options.onStage?.('deducing');
      // Images stay attached so that the deduction can double-check its own notes.
      const deduction = validateDeduction(
        await generate(ctx, model, [...imageParts, { text: buildDeductionPrompt(observation, measurements, options.language, hints) }], DEDUCTION_SCHEMA)
      );
      return { model, observation, deduction };
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err;
      if (err.reason === 'bad_key' || err.reason === 'blocked') throw err;
      lastError = err;
    }
  }
  throw lastError;
}

export interface KeyCheck {
  valid: boolean;
  reason?: AiFailure;
  detail: string;
  model?: string;
}

/** Live check of a key against the account's model list. Spends no generation quota. */
export async function checkKey(apiKey: string, fetchImpl?: FetchLike): Promise<KeyCheck> {
  const ctx: CallContext = {
    fetchImpl: fetchImpl ?? ((...args) => fetch(...args)),
    apiKey,
    sleep: async () => {},
    timeoutMs: 15000,
  };
  try {
    const models = await chooseModels(ctx);
    return { valid: true, detail: models[0], model: models[0] };
  } catch (err) {
    const failure = err as GeminiError;
    return { valid: false, reason: failure.reason, detail: failure.message };
  }
}
