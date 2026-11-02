import Anthropic from '@anthropic-ai/sdk';
import {
  AiAnalysis,
  AiCallOptions,
  AiError,
  AiImage,
  AiRefinement,
  DEDUCTION_SCHEMA,
  GenerateJson,
  JsonSchema,
  KeyCheck,
  TokenUsage,
  observeThenDeduce,
  parseJsonLoose,
  validateDeduction,
} from './analysis';

export const CLAUDE_MODEL = 'claude-opus-5-5';

/** Reading fabric is a judgement call, so depth matters more than speed here. */
const EFFORT = 'high' as const;

/** Structured outputs need every object closed and every property listed as required. */
export function toClaudeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toClaudeSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties') {
      out.properties = Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, toClaudeSchema(v)]));
    } else if (key === 'items') {
      out.items = toClaudeSchema(value);
    } else if (key !== 'required') {
      out[key] = value;
    }
  }
  if (out.type === 'object') {
    out.additionalProperties = false;
    out.required = Object.keys((out.properties as object) ?? {});
  }
  return out;
}

function mapError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiError('bad_key', err.message);
  }
  if (err instanceof Anthropic.RateLimitError) return new AiError('quota', err.message);
  if (err instanceof Anthropic.NotFoundError) return new AiError('no_model', err.message);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AiError('timeout', err.message);
  if (err instanceof Anthropic.APIConnectionError) return new AiError('network', err.message);
  if (err instanceof Anthropic.BadRequestError) return new AiError('invalid_response', err.message);
  if (err instanceof Anthropic.APIError) return new AiError('network', err.message);
  return new AiError('network', (err as Error).message || 'Network error');
}

function clientFor(options: Pick<AiCallOptions, 'apiKey' | 'fetchImpl' | 'timeoutMs'>): Anthropic {
  return new Anthropic({
    apiKey: options.apiKey,
    // Fixed, so that a stray ANTHROPIC_BASE_URL can never send the knitter's key somewhere else.
    baseURL: 'https://api.anthropic.com',
    // The key belongs to the knitter and stays on their own device. There is no server to hide it behind.
    dangerouslyAllowBrowser: true,
    maxRetries: 3,
    timeout: options.timeoutMs ?? 180000,
    ...(options.fetchImpl ? { fetch: options.fetchImpl } : {}),
  });
}

function claudeGenerator(images: AiImage[], options: AiCallOptions, model: string, usage: TokenUsage): GenerateJson {
  const client = clientFor(options);
  const imageBlocks = images.map((img) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: img.mimeType as 'image/jpeg', data: img.base64 },
  }));
  return async (prompt: string, schema: JsonSchema): Promise<unknown> => {
    let lastError = new AiError('invalid_response', 'No answer');
    // The SDK already retries rate limits and overloads, so this loop only covers unusable answers.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: EFFORT, format: { type: 'json_schema', schema: toClaudeSchema(schema) as Record<string, unknown> } },
        // If a safety check wrongly declines a photo, the API retries on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: prompt }] }],
      } as Parameters<typeof client.beta.messages.create>[0], {}) as Anthropic.Beta.BetaMessage;
      usage.inputTokens += response.usage.input_tokens ?? 0;
      usage.outputTokens += response.usage.output_tokens ?? 0;
      if (response.stop_reason === 'refusal') {
        throw new AiError('blocked', response.stop_details?.explanation ?? 'Declined by a safety check');
      }
      if (response.stop_reason === 'max_tokens') {
        lastError = new AiError('invalid_response', 'The answer was cut off');
        continue;
      }
      const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
      try {
        return parseJsonLoose(text);
      } catch (err) {
        lastError = new AiError('invalid_response', (err as Error).message);
      }
    }
    throw lastError;
  };
}

export async function analyzeWithClaude(
  images: AiImage[],
  measurements: string,
  hints: string | undefined,
  options: AiCallOptions
): Promise<AiAnalysis> {
  const model = options.model ?? CLAUDE_MODEL;
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  try {
    const generate = claudeGenerator(images, options, model, usage);
    const { observation, deduction } = await observeThenDeduce(generate, images, measurements, hints, options);
    return { provider: 'claude', model, observation, deduction, usage };
  } catch (err) {
    throw mapError(err);
  }
}

export async function refineWithClaude(images: AiImage[], prompt: string, options: AiCallOptions): Promise<AiRefinement> {
  const model = options.model ?? CLAUDE_MODEL;
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  try {
    const raw = await claudeGenerator(images, options, model, usage)(prompt, DEDUCTION_SCHEMA);
    return { provider: 'claude', model, deduction: validateDeduction(raw), usage };
  } catch (err) {
    throw mapError(err);
  }
}

/** Live key check that asks for the model's details, which costs nothing. */
export async function checkClaudeKey(apiKey: string, fetchImpl?: typeof fetch): Promise<KeyCheck> {
  try {
    const model = await clientFor({ apiKey, fetchImpl, timeoutMs: 15000 }).models.retrieve(CLAUDE_MODEL);
    return { valid: true, detail: model.id, model: model.id };
  } catch (err) {
    const failure = mapError(err);
    return { valid: false, reason: failure.reason, detail: failure.message };
  }
}
