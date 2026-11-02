import {
  AiAnalysis,
  AiCallOptions,
  AiError,
  AiImage,
  AiRefinement,
  DEDUCTION_SCHEMA,
  JsonSchema,
  KeyCheck,
  TokenUsage,
  parseJsonLoose,
  observeThenDeduce,
  validateDeduction,
} from './analysis';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Tried in order when the account's model list cannot be read. */
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

/** Gemini's schema dialect: upper-case types and a `nullable` flag instead of a type list. */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type') {
      const types = Array.isArray(value) ? value : [value];
      const real = types.find((t) => t !== 'null');
      out.type = String(real).toUpperCase();
      if (types.includes('null')) out.nullable = true;
    } else if (key === 'properties') {
      out.properties = Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, toGeminiSchema(v)]));
    } else if (key === 'items') {
      out.items = toGeminiSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function classifyHttp(status: number, message: string): AiError {
  if (status === 400 && /api key/i.test(message)) return new AiError('bad_key', message);
  if (status === 401 || status === 403) return new AiError('bad_key', message);
  if (status === 429) return new AiError('quota', message);
  if (status === 404) return new AiError('no_model', message);
  return new AiError('network', `HTTP ${status}: ${message}`);
}

interface CallContext {
  fetchImpl: typeof fetch;
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
    if ((err as Error).name === 'AbortError') throw new AiError('timeout', 'The request took too long');
    throw new AiError('network', (err as Error).message || 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

/** Calls one model, retrying what can recover: rate limits, overloads and malformed answers. */
async function generate(ctx: CallContext, model: string, parts: unknown[], schema: JsonSchema, usage: TokenUsage): Promise<unknown> {
  let lastError: AiError = new AiError('network', 'No attempt made');
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
            responseSchema: toGeminiSchema(schema),
          },
        }),
      });
    } catch (err) {
      lastError = err as AiError;
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
    usage.inputTokens += data?.usageMetadata?.promptTokenCount ?? 0;
    usage.outputTokens += data?.usageMetadata?.candidatesTokenCount ?? 0;
    usage.cachedInputTokens += data?.usageMetadata?.cachedContentTokenCount ?? 0;
    if (data?.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
      throw new AiError('blocked', data?.promptFeedback?.blockReason || 'Blocked by safety filter');
    }
    const content: string | undefined = candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('');
    if (!content) {
      lastError = new AiError('invalid_response', 'Empty response');
      continue;
    }
    try {
      return parseJsonLoose(content);
    } catch (err) {
      lastError = new AiError('invalid_response', (err as Error).message);
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
    if (err instanceof AiError && err.reason === 'bad_key') throw err;
    return FALLBACK_MODELS;
  }
}

export async function analyzeWithGemini(
  images: AiImage[],
  measurements: string,
  hints: string | undefined,
  options: AiCallOptions
): Promise<AiAnalysis> {
  const ctx: CallContext = {
    fetchImpl: options.fetchImpl ?? ((...args) => fetch(...args)),
    apiKey: options.apiKey,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    timeoutMs: options.timeoutMs ?? 90000,
  };
  const models = options.model ? [options.model] : await chooseModels(ctx);

  const imageParts = images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
  let lastError: AiError = new AiError('no_model', 'No model available');
  for (const model of models) {
    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
    try {
      const { observation, deduction } = await observeThenDeduce(
        (prompt, schema) => generate(ctx, model, [...imageParts, { text: prompt }], schema, usage),
        images,
        measurements,
        hints,
        options
      );
      return { provider: 'gemini', model, observation, deduction, usage };
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      if (err.reason === 'bad_key' || err.reason === 'blocked') throw err;
      lastError = err;
    }
  }
  throw lastError;
}

export async function refineWithGemini(images: AiImage[], prompt: string, options: AiCallOptions): Promise<AiRefinement> {
  const ctx: CallContext = {
    fetchImpl: options.fetchImpl ?? ((...args) => fetch(...args)),
    apiKey: options.apiKey,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    timeoutMs: options.timeoutMs ?? 90000,
  };
  const models = options.model ? [options.model] : await chooseModels(ctx);
  const parts = [...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })), { text: prompt }];
  let lastError: AiError = new AiError('no_model', 'No model available');
  for (const model of models) {
    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
    try {
      const raw = await generate(ctx, model, parts, DEDUCTION_SCHEMA, usage);
      return { provider: 'gemini', model, deduction: validateDeduction(raw), usage };
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      if (err.reason === 'bad_key' || err.reason === 'blocked') throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/** Live check of a key against the account's model list. Spends no generation quota. */
export async function checkGeminiKey(apiKey: string, fetchImpl?: typeof fetch): Promise<KeyCheck> {
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
    const failure = err as AiError;
    return { valid: false, reason: failure.reason, detail: failure.message };
  }
}
