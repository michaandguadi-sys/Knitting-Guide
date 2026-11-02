import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithGemini, chooseModels, GeminiError, parseJsonLoose, validateDeduction, AiImage, checkKey } from './gemini';
import { decodePhotos } from './decodePhotos';
import { applyAnswer, buildQuestions, CONFIRM_BELOW, gaugeFromWidth, isReadyToCompile, manualDecoded, toBlueprint, yarnFromGauge } from './reconcile';
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
  await assert.rejects(analyzeWithGemini(images, 'm', undefined, opts(impl)), (e: GeminiError) => e.reason === 'bad_key');
  assert.equal(calls, 1);
  const check = await checkKey('nope', impl);
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
  const report = await decodePhotos([photo('garter')], { language: 'en', encodeJpeg, apiKey: 'k', fetchImpl: impl, sleep: async () => {} });
  assert.equal(report.ai.state, 'failed');
  assert.equal(report.decoded.stitch.value, 'garter');
  assert.equal(report.readyToCompile, false);
});

test('AI agreement with the measurements raises trust; a clash lowers it and flags it', async () => {
  const run = async (stitch: string) => {
    const { impl } = scripted([() => candidate(observation), () => candidate({ ...goodDeduction, main_stitch: stitch })]);
    return decodePhotos([photo('garter')], { language: 'en', encodeJpeg, apiKey: 'k', fetchImpl: impl, sleep: async () => {} });
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
  const report = await decodePhotos([photo('seed')], { language: 'en', encodeJpeg, apiKey: 'k', fetchImpl: impl, sleep: async () => {} });
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
