import test from 'node:test';
import assert from 'node:assert/strict';
import { AiError, AiImage, parseJsonLoose, validateDeduction } from './analysis';
import { analyzeWithGemini, checkGeminiKey, chooseModels, toGeminiSchema } from './gemini';
import { CLAUDE_MODEL, analyzeWithClaude, checkClaudeKey, toClaudeSchema } from './claude';
import { buildMarkImages, cropToFocus, decodePhotos, refineReport } from './decodePhotos';
import { CANT_TELL } from './types';
import { spotForQuestion, whereToLook } from './questionSpots';
import { applyAnswer, buildQuestions, CONFIRM_BELOW, describeChanges, gaugeFromWidth, isReadyToCompile, keepYourAnswers, knownFacts, manualDecoded, toBlueprint, yarnFromGauge } from './reconcile';
import { renderFabric } from '../vision/testing/synthFabric';
import { compilePattern, verifyPattern } from '../engine/compiler';
import { readFabric } from '../vision/pipeline';

const goodDeduction = {
  input_kind: 'knitted_item',
  garment: 'beanie',
  garment_confidence: 0.95,
  main_stitch: 'rib_1x1',
  main_stitch_confidence: 0.92,
  main_stitch_evidence: 'Alternating raised and sunken columns.',
  main_stitch_lookalikes: ['fishermans_rib'],
  edge_stitch: 'same',
  edge_stitch_confidence: 0.8,
  method: 'round',
  method_confidence: 0.9,
  method_evidence: 'No seam visible.',
  direction: 'bottom_up',
  direction_confidence: 0.8,
  direction_evidence: 'Gathered crown.',
  folded_brim: true,
  folded_brim_confidence: 0.9,
  crown_wedges: 4,
  crown_confidence: 0.7,
  colorwork: 'solid',
  colorwork_confidence: 0.9,
  made_by: 'hand',
  made_by_confidence: 0.6,
  made_by_evidence: 'Slightly uneven tension.',
  yarn_weight: 'Worsted / Aran',
  needle_mm: 4.5,
  yarn_confidence: 0.5,
  title: 'Ribbed hat',
  features: [],
  notes: [],
};

const observation = {
  input_kind: 'knitted_item',
  surface_look: 'columns',
  vs_or_bumps: 'Vs',
  visible_lines: 'vertical',
  edges: 'fold',
  seam_or_jog: 'none',
  shaping: 'gathered',
  colour_changes: 'none',
  cannot_see: 'inside',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const candidate = (body: unknown) => json({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] });
const modelList = () => json({ models: [{ name: 'models/gemini-9.0-flash', supportedGenerationMethods: ['generateContent'] }] });

function scripted(responses: (() => Response)[]) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: String(init?.body ?? '') });
    if (String(url).includes('/models?')) return modelList();
    const next = responses.shift();
    if (!next) throw new Error('Unexpected call');
    return next();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const images: AiImage[] = [{ slot: 'front', caption: 'x', mimeType: 'image/jpeg', base64: 'AAAA' }];
const opts = (impl: typeof fetch) => ({ apiKey: 'test-key', language: 'en' as const, fetchImpl: impl, sleep: async () => {} });

test('two-stage call: observation first, deduction second, key never in the URL', async () => {
  const { impl, calls } = scripted([() => candidate(observation), () => candidate(goodDeduction)]);
  const result = await analyzeWithGemini(images, 'm', undefined, opts(impl));
  assert.equal(result.deduction.main_stitch, 'rib_1x1');
  assert.equal(result.model, 'gemini-9.0-flash');
  const gen = calls.filter((c) => c.url.includes(':generateContent'));
  assert.equal(gen.length, 2);
  assert.ok(gen[0].body.includes('Do not name stitches'));
  assert.ok(gen[1].body.includes('master hand-knitter'));
  assert.ok(calls.every((c) => !c.url.includes('test-key')));
  assert.equal(calls[0].headers['x-goog-api-key'], 'test-key');
});

test('recovers from a rate limit and from garbled JSON', async () => {
  const garbled = () => json({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] });
  const { impl } = scripted([
    () => json({ error: { message: 'slow down' } }, 429),
    () => candidate(observation),
    garbled,
    () => candidate(goodDeduction),
  ]);
  const result = await analyzeWithGemini(images, 'm', undefined, opts(impl));
  assert.equal(result.deduction.garment, 'beanie');
});

test('a rejected key fails at once without retries', async () => {
  let calls = 0;
  const impl = (async () => {
    calls++;
    return json({ error: { message: 'API key not valid' } }, 400);
  }) as unknown as typeof fetch;
  await assert.rejects(analyzeWithGemini(images, 'm', undefined, opts(impl)), (e: AiError) => e.reason === 'bad_key');
  assert.equal(calls, 1);
  const check = await checkGeminiKey('nope', impl);
  assert.equal(check.valid, false);
});

test('model discovery picks the newest flash model and skips the wrong kinds', async () => {
  const impl = (async () =>
    json({
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.5-flash-image', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-4.0-pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-9-flash', supportedGenerationMethods: ['embedContent'] },
      ],
    })) as unknown as typeof fetch;
  const models = await chooseModels({ fetchImpl: impl, apiKey: 'k', sleep: async () => {}, timeoutMs: 1000 });
  assert.equal(models[0], 'gemini-3.0-flash');
  assert.ok(!models.some((m) => /image|lite|pro/.test(m)));
});

test('falls back to the next model when one has been retired', async () => {
  const impl = (async (url: string) => {
    if (url.includes('/models?')) {
      return json({
        models: [
          { name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      });
    }
    if (url.includes('gemini-3.0-flash')) return json({ error: { message: 'gone' } }, 404);
    return url.includes('generateContent') && impl.calls++ === 0 ? candidate(observation) : candidate(goodDeduction);
  }) as unknown as typeof fetch & { calls: number };
  impl.calls = 0;
  const result = await analyzeWithGemini(images, 'm', undefined, opts(impl));
  assert.equal(result.model, 'gemini-2.5-flash');
});

test('validation rejects invented stitches and never fills gaps from another garment', () => {
  assert.throws(() => validateDeduction({ ...goodDeduction, main_stitch: 'magic_stitch' }));
  const d = validateDeduction({ main_stitch: 'garter' });
  assert.equal(d.main_stitch, 'garter');
  assert.equal(d.main_stitch_confidence, 0);
  assert.equal(d.method, 'unknown');
  assert.equal(d.crown_wedges, null);
  assert.equal(d.title, '');
  assert.deepEqual(d.features, []);
});

test('fenced or chatty JSON is still read', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Here you go: {"a":1} done'), { a: 1 });
});

const photo = (stitch: Parameters<typeof renderFabric>[0]['stitch']) => {
  const raster = renderFabric({ stitch, width: 640, height: 640 });
  return { slot: 'closeup' as const, raster, originalLongSide: 1600 };
};
const encodeJpeg = async () => 'AAAA';

/** A piece of fabric on a plain pale table, so that it has a measured outline. */
function onHat() {
  const fabric = renderFabric({ stitch: 'rib_1x1', width: 520, height: 460, color: [120, 40, 40] });
  const width = 960;
  const height = 800;
  const data = new Uint8ClampedArray(width * height * 4).fill(215);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (let y = 0; y < 460; y++) {
    data.set(fabric.data.subarray(y * 520 * 4, (y + 1) * 520 * 4), ((y + 170) * width + 220) * 4);
  }
  return { width, height, data };
}

const claudeReply = (body: unknown, extra: Record<string, unknown> = {}) =>
  json({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: CLAUDE_MODEL,
    stop_reason: 'end_turn',
    stop_sequence: null,
    content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: JSON.stringify(body) }],
    usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 100 },
    ...extra,
  });

function claudeServer(responses: (() => Response)[]) {
  const bodies: Record<string, any>[] = [];
  const urls: string[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    urls.push(String(url));
    if (init?.body) bodies.push(JSON.parse(String(init.body)));
    const next = responses.shift();
    if (!next) throw new Error('Unexpected call');
    return next();
  }) as unknown as typeof fetch;
  return { impl, bodies, urls };
}

test('Claude: two steps, closed schema, cached images, right model and effort', async () => {
  const { impl, bodies } = claudeServer([() => claudeReply(observation), () => claudeReply(goodDeduction)]);
  const stages: string[] = [];
  const result = await analyzeWithClaude(images, 'm', undefined, { apiKey: 'k', language: 'en', fetchImpl: impl, onStage: (s) => stages.push(s) });
  assert.equal(result.provider, 'claude');
  assert.equal(result.model, 'claude-opus-5-5');
  assert.equal(result.deduction.main_stitch, 'rib_1x1');
  assert.deepEqual(stages, ['observing', 'deducing']);
  assert.equal(bodies.length, 2);
  for (const body of bodies) {
    assert.equal(body.model, 'claude-opus-5-5');
    assert.equal(body.temperature, undefined);
    assert.equal(body.output_config.effort, 'high');
    assert.equal(body.output_config.format.type, 'json_schema');
    assert.equal(body.output_config.format.schema.additionalProperties, false);
    assert.equal(body.fallbacks, 'default');
    assert.equal(body.messages[0].content[0].source.type, 'base64');
  }
  assert.ok(bodies[0].messages[0].content.at(-1).text.includes('Do not name stitches'));
  assert.ok(bodies[1].messages[0].content.at(-1).text.includes('master hand-knitter'));
  assert.deepEqual(result.usage, { inputTokens: 20, outputTokens: 40, cachedInputTokens: 0 });
});

test('Claude schema lists every field as required; Gemini schema uses its own dialect', () => {
  const source = { type: 'object', properties: { a: { type: ['integer', 'null'] }, b: { type: 'array', items: { type: 'object', properties: { c: { type: 'string' } } } } }, required: ['a'] };
  const claude = toClaudeSchema(source) as any;
  assert.deepEqual(claude.required, ['a', 'b']);
  assert.equal(claude.additionalProperties, false);
  assert.deepEqual(claude.properties.a.type, ['integer', 'null']);
  assert.equal(claude.properties.b.items.additionalProperties, false);
  const gemini = toGeminiSchema(source) as any;
  assert.equal(gemini.type, 'OBJECT');
  assert.equal(gemini.properties.a.type, 'INTEGER');
  assert.equal(gemini.properties.a.nullable, true);
  assert.equal(gemini.properties.b.items.properties.c.type, 'STRING');
});

test('Claude errors become plain reasons, and a bad key is not retried', async () => {
  const failing = (status: number, type: string) => {
    let calls = 0;
    const impl = (async () => {
      calls++;
      return json({ type: 'error', error: { type, message: type } }, status);
    }) as unknown as typeof fetch;
    return { impl, count: () => calls };
  };
  const bad = failing(401, 'authentication_error');
  await assert.rejects(analyzeWithClaude(images, 'm', undefined, { apiKey: 'k', language: 'en', fetchImpl: bad.impl }), (e: AiError) => e.reason === 'bad_key');
  assert.equal(bad.count(), 1);
  const check = await checkClaudeKey('nope', failing(401, 'authentication_error').impl);
  assert.equal(check.valid, false);
  assert.equal(check.reason, 'bad_key');
});

test('Claude: a declined photo is reported, and a garbled answer is retried', async () => {
  const declined = claudeServer([() => claudeReply({}, { stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'no' }, content: [] })]);
  await assert.rejects(analyzeWithClaude(images, 'm', undefined, { apiKey: 'k', language: 'en', fetchImpl: declined.impl }), (e: AiError) => e.reason === 'blocked');

  const garbled = () => claudeReply({}, { content: [{ type: 'text', text: 'not json' }] });
  const recovering = claudeServer([garbled, () => claudeReply(observation), () => claudeReply(goodDeduction)]);
  const ok = await analyzeWithClaude(images, 'm', undefined, { apiKey: 'k', language: 'en', fetchImpl: recovering.impl });
  assert.equal(ok.deduction.garment, 'beanie');
});

test('the second AI steps in when the first fails, and the report names the one used', async () => {
  const impl = (async (url: string) => {
    if (String(url).includes('anthropic')) return json({ type: 'error', error: { type: 'authentication_error', message: 'bad' } }, 401);
    if (String(url).includes('/models?')) return modelList();
    return impl.calls++ === 0 ? candidate(observation) : candidate(goodDeduction);
  }) as unknown as typeof fetch & { calls: number };
  impl.calls = 0;
  const report = await decodePhotos([photo('rib_1x1')], {
    language: 'en',
    encodeJpeg,
    ai: [{ provider: 'claude', apiKey: 'a' }, { provider: 'gemini', apiKey: 'b' }],
    fetchImpl: impl,
    sleep: async () => {},
  });
  assert.equal(report.ai.state, 'used');
  assert.equal(report.ai.state === 'used' && report.ai.provider, 'gemini');
});

test('without a key the result admits it, stays under the confirm line and asks', async () => {
  const report = await decodePhotos([photo('rib_1x1')], { language: 'en', encodeJpeg });
  assert.equal(report.ai.state, 'no_key');
  assert.ok(report.decoded.stitch.confidence < CONFIRM_BELOW);
  assert.equal(report.readyToCompile, false);
  assert.ok(report.questions.some((q) => q.field === 'stitch'));
  assert.ok(report.questions.some((q) => q.field === 'garment'));
  // Once it is a hat, how it was worked starts to matter, and the next round of questions asks.
  const asHat = applyAnswer(report.decoded, 'garment', 'beanie');
  assert.ok(buildQuestions(asHat, 'en').some((q) => q.field === 'method'));
});

test('a failed AI call is reported, and the photo is still measured', async () => {
  const impl = (async () => json({ error: { message: 'boom' } }, 500)) as unknown as typeof fetch;
  const report = await decodePhotos([photo('garter')], { language: 'en', encodeJpeg, ai: [{ provider: 'gemini', apiKey: 'k' }], fetchImpl: impl, sleep: async () => {} });
  assert.equal(report.ai.state, 'failed');
  assert.equal(report.decoded.stitch.value, 'garter');
  assert.equal(report.readyToCompile, false);
});

test('AI agreement with the measurements raises trust; a clash lowers it and flags it', async () => {
  const run = async (stitch: string) => {
    const { impl } = scripted([() => candidate(observation), () => candidate({ ...goodDeduction, main_stitch: stitch })]);
    return decodePhotos([photo('garter')], { language: 'en', encodeJpeg, ai: [{ provider: 'gemini', apiKey: 'k' }], fetchImpl: impl, sleep: async () => {} });
  };
  const agree = await run('garter');
  const clash = await run('rib_1x1');
  assert.equal(agree.decoded.stitch.source, 'ai');
  assert.ok(agree.decoded.stitch.confidence > clash.decoded.stitch.confidence);
  assert.ok(clash.decoded.notes.some((n) => n.includes('measurements')));
  assert.ok(clash.decoded.stitch.alternatives?.includes('garter'));
});

test('crochet is refused rather than given a knitting pattern', async () => {
  const { impl } = scripted([() => candidate({ ...observation, input_kind: 'crochet' }), () => candidate({ ...goodDeduction, input_kind: 'crochet' })]);
  const report = await decodePhotos([photo('seed')], { language: 'en', encodeJpeg, ai: [{ provider: 'gemini', apiKey: 'k' }], fetchImpl: impl, sleep: async () => {} });
  assert.equal(report.decoded.inputKind.value, 'crochet');
  assert.equal(isReadyToCompile(report.decoded), false);
});

test('your answer outranks everything and clears the question', async () => {
  const report = await decodePhotos([photo('rib_2x2')], { language: 'en', encodeJpeg });
  let d = report.decoded;
  for (let round = 0; round < 6; round++) {
    for (const q of buildQuestions(d, 'en')) d = applyAnswer(d, q.field, q.options[0].value);
  }
  assert.equal(buildQuestions(d, 'en').length, 0);
  d = applyAnswer(d, 'stitch', 'seed_stitch');
  assert.equal(d.stitch.value, 'seed_stitch');
  assert.equal(d.stitch.confidence, 1);
  assert.equal(d.stitch.source, 'you');
  assert.equal(isReadyToCompile(d), true);
});

test('a scarf is never asked about seams, and is ready once its stitch is known', () => {
  let d = applyAnswer(manualDecoded('en'), 'garment', 'scarf');
  assert.equal(buildQuestions(d, 'en').some((q) => q.field === 'method'), false);
  d = applyAnswer(d, 'stitch', 'garter');
  assert.equal(isReadyToCompile(d), true);
});

test('a decode turns into a pattern that knits cleanly, whatever is picked', () => {
  const reading = readFabric(renderFabric({ stitch: 'rib_1x1', stripe: { color: [240, 240, 235], every: 8, width: 2 }, width: 640, height: 640 }));
  for (const garment of ['beanie', 'scarf', 'cowl', 'pullover', 'swatch'] as const) {
    for (const method of ['round', 'flat'] as const) {
      let d = manualDecoded('en');
      d = applyAnswer(d, 'garment', garment);
      d = applyAnswer(d, 'method', method);
      d = applyAnswer(d, 'stitch', 'stockinette');
      d = { ...d, colorwork: { ...d.colorwork, value: 'vertical_stripes' } };
      const bp = toBlueprint(d, reading, 'en');
      const pattern = compilePattern(bp, {
        targetSize: 'x',
        circumferenceCm: 56,
        lengthCm: garment === 'scarf' ? 160 : 22,
        gaugeSts10cm: 18,
        gaugeRows10cm: 24,
        easeCm: 0,
        needleSizeMm: 4.5,
        yarnWeight: 'Worsted / Aran',
        language: 'en',
      });
      assert.deepEqual(verifyPattern(pattern), []);
    }
  }
});

test('a measured width turns stitches into a real gauge', () => {
  const reading = readFabric(renderFabric({ stitch: 'stockinette', stitchPx: 20, rowPx: 15, width: 640, height: 640 }));
  // 32 stitches across, and 18 cm wide gives about 17.8 sts per 10 cm.
  const gauge = gaugeFromWidth(reading, 18)!;
  assert.ok(Math.abs(gauge.stsPer10cm - 17.8) < 1, String(gauge.stsPer10cm));
  assert.ok(Math.abs(gauge.rowsPer10cm! - 17.8 * (20 / 15)) < 2);
  assert.equal(yarnFromGauge(gauge.stsPer10cm).weight, 'Worsted / Aran');
  assert.equal(gaugeFromWidth(reading, 0), null);
});

const decodeForRefine = async () => {
  const { impl } = claudeServer([() => claudeReply(observation), () => claudeReply(goodDeduction)]);
  return decodePhotos([{ slot: 'front', raster: renderFabric({ stitch: 'rib_1x1', width: 640, height: 640 }), originalLongSide: 1600 }], {
    language: 'en',
    encodeJpeg,
    ai: [{ provider: 'claude', apiKey: 'k' }],
    fetchImpl: impl,
  });
};

test('a correction reaches the AI with the earlier reading, the marks and your confirmed facts', async () => {
  const report = await decodeForRefine();
  const decoded = applyAnswer(report.decoded, 'method', 'flat');
  const { impl, bodies } = claudeServer([
    () => claudeReply({ ...goodDeduction, main_stitch: 'fishermans_rib', method: 'round', reply_to_knitter: 'Changed to fisherman rib.' }),
  ]);
  const next = await refineReport(
    report,
    { note: 'It is much thicker than plain rib', marks: [{ x: 0.5, y: 0.8, note: 'look at the brim' }], decoded },
    { language: 'en', encodeJpeg, ai: [{ provider: 'claude', apiKey: 'k' }], fetchImpl: impl }
  );
  const content = bodies[0].messages[0].content;
  const prompt = content.at(-1).text;
  assert.ok(prompt.includes('It is much thicker than plain rib'));
  assert.ok(prompt.includes('Mark 1: look at the brim'));
  assert.ok(prompt.includes('It was worked: flat'));
  assert.ok(prompt.includes('"main_stitch": "rib_1x1"'), 'includes the earlier reading');
  assert.ok(prompt.includes('Do not simply agree'));
  assert.ok(prompt.includes('mark 1'), 'names the crop among the images');
  assert.equal(content.filter((b: { type: string }) => b.type === 'image').length, content.length - 1);
  assert.ok(content.length >= 4, 'whole photo, stitch map and the tapped crop at least');
  assert.equal(next.decoded.stitch.value, 'fishermans_rib');
  assert.equal(next.decoded.reply, 'Changed to fisherman rib.');
  assert.equal(next.decoded.method.value, 'flat', 'your answer outranks the new reading');
  assert.equal(next.decoded.method.source, 'you');
  assert.deepEqual(describeChanges(decoded, next.decoded, 'en').map((c) => c.field), ['Main stitch']);
});

test('a failed correction leaves the reading alone and says so', async () => {
  const report = await decodeForRefine();
  const impl = (async () => json({ type: 'error', error: { type: 'authentication_error', message: 'bad' } }, 401)) as unknown as typeof fetch;
  await assert.rejects(
    refineReport(report, { note: 'x', marks: [], decoded: report.decoded }, { language: 'en', encodeJpeg, ai: [{ provider: 'claude', apiKey: 'k' }], fetchImpl: impl }),
    (e: AiError) => e.reason === 'bad_key'
  );
  await assert.rejects(refineReport(report, { note: 'x', marks: [], decoded: report.decoded }, { language: 'en', encodeJpeg }));
  assert.equal(report.decoded.stitch.value, 'rib_1x1');
});

test('marks crop around the tapped spot and stay inside the photo', async () => {
  const reading = readFabric(renderFabric({ stitch: 'stockinette', width: 640, height: 640 }));
  const sizes: [number, number][] = [];
  const encode = async (raster: { width: number; height: number }) => {
    sizes.push([raster.width, raster.height]);
    return 'AAAA';
  };
  const images = await buildMarkImages(reading, [{ x: 0, y: 0, note: '' }, { x: 1, y: 1, note: '' }, { x: 0.5, y: 0.5, note: '' }], encode as never);
  assert.equal(images.length, 3);
  for (const [w, h] of sizes) {
    assert.equal(w, h);
    assert.ok(w >= 200 && w <= 800);
  }
});

test('facts list only what you answered, and a new reading cannot overrule them', () => {
  let mine = manualDecoded('en');
  assert.deepEqual(knownFacts(mine).filter((f) => f.includes('stitch')), []);
  mine = applyAnswer(mine, 'stitch', 'garter');
  assert.ok(knownFacts(mine).includes('The main stitch is: garter'));
  const ai = { ...manualDecoded('en'), stitch: { value: 'lace' as const, confidence: 0.9, source: 'ai' as const, evidence: '' } };
  assert.equal(keepYourAnswers(mine, ai).stitch.value, 'garter');
});

test('the AI can ask for the photo that would help most', async () => {
  const { impl } = claudeServer([
    () => claudeReply(observation),
    () => claudeReply({ ...goodDeduction, best_next_photo: 'inside', best_next_photo_reason: 'To see carried yarn.' }),
  ]);
  const report = await decodePhotos([photo('rib_1x1')], { language: 'en', encodeJpeg, ai: [{ provider: 'claude', apiKey: 'k' }], fetchImpl: impl });
  assert.deepEqual(report.decoded.nextPhoto, { slot: 'inside', reason: 'To see carried yarn.' });
  const none = validateDeduction({ main_stitch: 'garter', best_next_photo: 'nonsense' });
  assert.equal(none.best_next_photo, 'none');
});

test('one picture is enough: every question can be answered with "I only have the picture"', async () => {
  const report = await decodePhotos([{ slot: 'front', raster: renderFabric({ stitch: 'seed', width: 474, height: 474 }), originalLongSide: 474 }], { language: 'en', encodeJpeg });
  assert.ok(report.questions.length > 0);
  for (const q of report.questions) assert.ok(q.options.some((o) => o.value === CANT_TELL), q.field);
  let d = report.decoded;
  const before = d.stitch.value;
  for (let round = 0; round < 6; round++) {
    for (const q of buildQuestions(d, 'en')) d = applyAnswer(d, q.field, CANT_TELL);
  }
  assert.equal(buildQuestions(d, 'en').length, 0);
  assert.equal(isReadyToCompile(d), true);
  assert.equal(d.stitch.value, before, 'keeps the best guess');
  assert.notEqual(d.stitch.source, 'you', 'never presented as if the knitter confirmed it');
});

test('how the piece was worked never holds the pattern back', () => {
  let d = applyAnswer(manualDecoded('en'), 'garment', 'beanie');
  d = applyAnswer(d, 'stitch', 'garter');
  assert.ok(d.method.confidence < CONFIRM_BELOW);
  assert.equal(isReadyToCompile(d), true);
});

test('selecting one part: only that part is read, the whole picture is context, and it knits as fabric', async () => {
  // Left half is rib, right half garter: tapping the garter side must read garter.
  const rib = renderFabric({ stitch: 'rib_1x1', width: 500, height: 900 });
  const garter = renderFabric({ stitch: 'garter', width: 500, height: 900 });
  const whole = { width: 1000, height: 900, data: new Uint8ClampedArray(1000 * 900 * 4) };
  for (let y = 0; y < 900; y++) {
    whole.data.set(rib.data.subarray(y * 500 * 4, (y + 1) * 500 * 4), y * 1000 * 4);
    whole.data.set(garter.data.subarray(y * 500 * 4, (y + 1) * 500 * 4), (y * 1000 + 500) * 4);
  }
  const focus = { x: 0.75, y: 0.5, size: 0.45 };
  const part = cropToFocus(whole, focus);
  assert.equal(part.width, 405);
  const { impl, bodies } = claudeServer([
    () => claudeReply(observation),
    () => claudeReply({ ...goodDeduction, main_stitch: 'garter', how_to_steps: ['Knit a swatch first.', 'Knit every row.'] }),
  ]);
  const report = await decodePhotos([{ slot: 'front', raster: whole, originalLongSide: 1000 }], {
    language: 'en',
    encodeJpeg,
    focus,
    ai: [{ provider: 'claude', apiKey: 'k' }],
    fetchImpl: impl,
  });
  assert.equal(report.readings[0].reading.raster.width, 405);
  assert.equal(report.readings[0].reading.texture.family, 'horizontal_ridges');
  assert.equal(report.context, whole);
  assert.equal(report.decoded.garment.value, 'swatch');
  const prompt = bodies[0].messages[0].content.at(-1).text;
  assert.ok(prompt.includes('only for context') && prompt.includes('only wants to make the selected part'));
  const blueprint = toBlueprint(report.decoded, report.readings[0].reading, 'en');
  assert.deepEqual(blueprint.aiSteps, ['Knit a swatch first.', 'Knit every row.']);
  assert.deepEqual(verifyPattern(compilePattern(blueprint, { targetSize: 'x', circumferenceCm: 56, lengthCm: 22, gaugeSts10cm: 18, gaugeRows10cm: 24, easeCm: 0, needleSizeMm: 4.5, yarnWeight: 'Worsted / Aran', language: 'en' })), []);
});

test('a hat the compiler can write uses its checked steps, not the AI text', () => {
  let d = applyAnswer(manualDecoded('en'), 'garment', 'beanie');
  d = { ...applyAnswer(d, 'stitch', 'rib_1x1'), howTo: ['AI text'] };
  assert.equal(toBlueprint(d, null, 'en').aiSteps, undefined);
  const cable = { ...applyAnswer(d, 'stitch', 'cable'), howTo: ['Cross 6 sts every 8 rows'] };
  assert.deepEqual(toBlueprint(cable, null, 'en').aiSteps, ['Cross 6 sts every 8 rows']);
  const motif = { ...d, colorwork: { ...d.colorwork, value: 'stranded_motif' as const } };
  assert.deepEqual(toBlueprint(motif, null, 'en').aiSteps, ['AI text']);
});

test('progress reports each real result as soon as it exists', async () => {
  const seen: string[] = [];
  const { impl } = claudeServer([() => claudeReply(observation), () => claudeReply(goodDeduction)]);
  await decodePhotos([{ slot: 'front', raster: renderFabric({ stitch: 'garter', width: 640, height: 640 }), originalLongSide: 1600 }], {
    language: 'en',
    encodeJpeg,
    ai: [{ provider: 'claude', apiKey: 'k' }],
    fetchImpl: impl,
    onStage: (stage) => seen.push(stage),
    onReading: () => seen.push('reading'),
    onObservation: () => seen.push('observation'),
  });
  assert.deepEqual(seen, ['clean', 'reading', 'measure', 'observe', 'observation', 'deduce', 'done']);
});

test('questions mark a real spot on the picture, or none when no spot answers them', () => {
  const closeUp = readFabric(renderFabric({ stitch: 'stockinette', width: 640, height: 640 }));
  const spot = spotForQuestion('stitch', closeUp)!;
  for (const value of [spot.x, spot.y, spot.w, spot.h]) assert.ok(value >= 0 && value <= 1, String(value));
  assert.ok(spot.x + spot.w <= 1.001 && spot.y + spot.h <= 1.001);
  assert.equal(spotForQuestion('method', closeUp), null);
  assert.equal(spotForQuestion('foldedBrim', closeUp), null, 'a close-up has no brim to point at');
});

test('every question says what to look at', async () => {
  const report = await decodePhotos([photo('seed')], { language: 'es', encodeJpeg });
  let d = applyAnswer(report.decoded, 'garment', 'beanie');
  d = applyAnswer(d, 'stitch', 'seed_stitch');
  const all = [...report.questions, ...buildQuestions(d, 'es')];
  assert.ok(all.length >= 3);
  for (const q of all) assert.ok(q.where.length > 5, q.field);
});

test('the interview covers the crown, hand or machine, colours and yarn, each with a way out', async () => {
  const report = await decodePhotos([photo('rib_1x1')], { language: 'en', encodeJpeg });
  let d = applyAnswer(report.decoded, 'garment', 'beanie');
  d = applyAnswer(d, 'stitch', 'rib_1x1');
  const asked = buildQuestions(d, 'en');
  const fields = asked.map((q) => q.field);
  for (const field of ['crownWedges', 'madeBy', 'yarnWeight'] as const) assert.ok(fields.includes(field), field);
  for (const q of asked) {
    assert.ok(q.options.some((o) => o.value === CANT_TELL), `${q.field} has a way out`);
    assert.ok(q.where.length > 5, `${q.field} says where to look`);
  }
  const crown = asked.find((q) => q.field === 'crownWedges')!;
  assert.ok(crown.options.some((o) => o.value === 'null'), 'a rib hat can have ribs to the centre');
});

test('a plain hat is not offered ribs to the centre', () => {
  let d = applyAnswer(manualDecoded('en'), 'garment', 'beanie');
  d = applyAnswer(d, 'stitch', 'stockinette');
  const crown = buildQuestions(d, 'en').find((q) => q.field === 'crownWedges')!;
  assert.equal(crown.options.some((o) => o.value === 'null'), false);
});

test('the crown answer changes the pattern that gets written', () => {
  const size = { targetSize: 'x', circumferenceCm: 56, lengthCm: 22, brimLengthCm: 7.5, gaugeSts10cm: 18, gaugeRows10cm: 24, easeCm: -4, needleSizeMm: 4.5, yarnWeight: 'Worsted / Aran' as const, language: 'en' as const };
  let d = applyAnswer(manualDecoded('en'), 'garment', 'beanie');
  d = applyAnswer(d, 'stitch', 'rib_1x1');
  const crownOps = (decoded: typeof d) => {
    const pattern = compilePattern(toBlueprint(decoded, null, 'en'), size);
    assert.deepEqual(verifyPattern(pattern), []);
    return pattern.sections.find((s) => s.id === 'crown')!.instructions.flatMap((i) => i.rows ?? []).flatMap((r) => r.ops);
  };
  const ribs = crownOps(applyAnswer(d, 'crownWedges', 'null'));
  assert.ok(ribs.includes('p2tog') && !ribs.includes('ssk'));
  const lines = crownOps(applyAnswer(d, 'crownWedges', '6'));
  assert.ok(lines.includes('ssk'));
  // An unsure guess of 4 wedges must not override the ribs.
  const guessed = crownOps({ ...d, crownWedges: { value: 4, confidence: 0.3, source: 'ai', evidence: '' } });
  assert.ok(guessed.includes('p2tog'));
});

test('a finger count sets the yarn and the needle together', () => {
  const d = applyAnswer(manualDecoded('en'), 'yarnWeight', 'Chunky / Bulky');
  assert.equal(d.yarnWeight.value, 'Chunky / Bulky');
  assert.equal(d.needleMm.value, 6);
  assert.equal(d.needleMm.source, 'you');
});

test('the new questions mark the right part of a whole hat', () => {
  const hat = readFabric(onHat());
  const crown = spotForQuestion('crownWedges', hat)!;
  const made = spotForQuestion('madeBy', hat)!;
  assert.ok(crown.y < 0.4, `crown ${crown.y}`);
  assert.ok(made.y > 0.5, `edge ${made.y}`);
  assert.equal(spotForQuestion('colorwork', hat), null);
});

test('a close-up never points at a marked part it cannot mark', () => {
  const closeUp = readFabric(renderFabric({ stitch: 'rib_1x1', width: 960, height: 800, color: [120, 40, 40] }));
  assert.equal(spotForQuestion('crownWedges', closeUp), null);
  let d = applyAnswer(manualDecoded('en'), 'garment', 'beanie');
  d = applyAnswer(d, 'stitch', 'rib_1x1');
  for (const q of buildQuestions(d, 'en')) {
    const where = whereToLook(q, spotForQuestion(q.field, closeUp), 'en');
    if (!spotForQuestion(q.field, closeUp)) assert.ok(!/marked/i.test(where), `${q.field}: ${where}`);
  }
});
