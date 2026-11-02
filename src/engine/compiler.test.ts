import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lcm,
  roundToMultiple,
  compileBeaniePattern,
  compileCowlPattern,
  compilePattern,
  compileScarfPattern,
  verifyPattern,
} from './compiler';
import { STITCHES, countRow, rowToText } from './stitches';
import { ConstructionType, GarmentType, KnitBlueprint, KnitUserConstraints, StitchType } from '../types/knit';

const blueprint = (over: Partial<KnitBlueprint> = {}): KnitBlueprint => ({
  garmentType: 'beanie',
  title: 'Test hat',
  description: '',
  construction: 'in_the_round',
  mainStitch: 'rib_1x1',
  hasFoldedBrim: true,
  crownWedges: 4,
  colorworkType: 'solid',
  features: [],
  suggestedYarnWeight: 'Worsted / Aran',
  suggestedNeedleMm: 4.5,
  difficulty: 'Intermediate',
  confidenceScore: null,
  ...over,
});

const constraints = (over: Partial<KnitUserConstraints> = {}): KnitUserConstraints => ({
  targetSize: 'adult_m',
  circumferenceCm: 56,
  lengthCm: 22,
  brimLengthCm: 7.5,
  gaugeSts10cm: 18,
  gaugeRows10cm: 24,
  easeCm: -4,
  needleSizeMm: 4.5,
  yarnWeight: 'Worsted / Aran',
  language: 'en',
  ...over,
});

test('lcm and roundToMultiple enforce repeat constraints', () => {
  assert.equal(lcm(4, 12), 12);
  assert.equal(roundToMultiple(93, 8), 96);
  assert.equal(roundToMultiple(83, 8), 80);
});

test('Spanish hat uses Argentine terms and correct counts', () => {
  const p = compileBeaniePattern(blueprint(), constraints({ language: 'es' }));
  assert.equal(p.calculatedGauge.castOnSts, 96);
  assert.ok(p.title.includes('Gorro'));
  const co = p.sections.find((s) => s.id === 'brim')!.instructions[0].instruction;
  assert.ok(co.includes('agujas circulares de 4.5 mm'));
  assert.ok(co.includes('montar 96 puntos'));
  assert.ok(co.includes('marcador de inicio de vuelta'));
  const abbr = p.abbreviations.map((a) => a.abbr);
  assert.ok(abbr.includes('2pjD') && abbr.includes('SS') && abbr.includes('MIV'));
});

test('every stitch, garment, method and gauge knits through the stitch counter cleanly', () => {
  const stitches = Object.keys(STITCHES) as StitchType[];
  const garments: GarmentType[] = ['beanie', 'cowl', 'scarf', 'pullover', 'swatch', 'other'];
  const constructions: ConstructionType[] = ['in_the_round', 'top_down_round', 'bottom_up_flat'];
  const gauges: [number, number][] = [[12, 16], [18, 24], [22, 30], [28, 38]];
  let compiled = 0;
  for (const garment of garments) {
    for (const stitch of stitches) {
      for (const construction of constructions) {
        for (const [sts, rows] of gauges) {
          for (const wedges of [4, 6, 5]) {
            for (const hasFoldedBrim of [true, false]) {
              for (const language of ['en', 'es'] as const) {
                const p = compilePattern(
                  blueprint({ garmentType: garment, mainStitch: stitch, construction, crownWedges: wedges, hasFoldedBrim }),
                  constraints({
                    gaugeSts10cm: sts,
                    gaugeRows10cm: rows,
                    language,
                    circumferenceCm: garment === 'scarf' ? 24 : 56,
                    lengthCm: garment === 'scarf' ? 170 : 22,
                  })
                );
                const problems = verifyPattern(p);
                assert.deepEqual(problems, [], `${garment}/${stitch}/${construction}/${sts}/${wedges}: ${problems[0]}`);
                compiled++;
              }
            }
          }
        }
      }
    }
  }
  assert.ok(compiled > 5000);
});

test('stockinette hat body really is stockinette, with a rib brim that will not curl', () => {
  const p = compileBeaniePattern(blueprint({ mainStitch: 'stockinette', hasFoldedBrim: false }), constraints());
  const brim = p.sections.find((s) => s.id === 'brim')!.instructions.find((i) => i.kind === 'work')!;
  assert.match(brim.rowTexts![0], /K1, P1/);
  const body = p.sections.find((s) => s.id === 'body')!.instructions.find((i) => i.kind === 'work')!;
  assert.equal(body.rows![0].ops.every((o) => o === 'k'), true);
});

test('garter in the round alternates knit and purl rounds; flat knits every row', () => {
  const round = compileCowlPattern(blueprint({ garmentType: 'cowl', mainStitch: 'garter' }), constraints({ circumferenceCm: 60, lengthCm: 25 }));
  const roundBody = round.sections.find((s) => s.id === 'body')!.instructions.find((i) => i.kind === 'work')!;
  assert.equal(roundBody.rows!.length, 2);
  assert.ok(roundBody.rows![0].ops.every((o) => o === 'k'));
  assert.ok(roundBody.rows![1].ops.every((o) => o === 'p'));

  const flat = compileCowlPattern(blueprint({ garmentType: 'cowl', mainStitch: 'garter', construction: 'bottom_up_flat' }), constraints({ circumferenceCm: 60, lengthCm: 25 }));
  const flatBody = flat.sections.find((s) => s.id === 'body')!.instructions.find((i) => i.kind === 'work')!;
  const inner = (ops: string[]) => ops.slice(1, -1);
  assert.ok(flatBody.rows!.every((r) => inner(r.ops).every((o) => o === 'k')), 'flat garter knits both sides');
});

test('stockinette flat flips to purl on the wrong side', () => {
  const p = compileBeaniePattern(blueprint({ mainStitch: 'stockinette', construction: 'bottom_up_flat', hasFoldedBrim: false }), constraints());
  const body = p.sections.find((s) => s.id === 'body')!.instructions.find((i) => i.kind === 'work')!;
  const rs = body.rows!.find((r) => r.side === 'RS')!;
  const ws = body.rows!.find((r) => r.side === 'WS')!;
  assert.ok(rs.ops.every((o) => o === 'k'));
  assert.ok(ws.ops.every((o) => o === 'p'));
});

test('rib stays lined up: a knit column never turns purl across the crown', () => {
  const p = compileBeaniePattern(blueprint(), constraints());
  const dec = p.sections.find((s) => s.id === 'crown')!.instructions.filter((i) => i.rows?.[0].ops.includes('ssk'));
  assert.ok(dec.length > 5);
  const text = dec[0].rowTexts![0];
  assert.ok(text.startsWith('*ssk') && text.includes('k2tog'), text);
});

test('cowl has no crown and scarf measures as a scarf', () => {
  const cowl = compileCowlPattern(blueprint({ garmentType: 'cowl' }), constraints({ circumferenceCm: 60, lengthCm: 25 }));
  assert.equal(cowl.sections.some((s) => s.id === 'crown'), false);
  const scarf = compileScarfPattern(blueprint({ garmentType: 'scarf', mainStitch: 'garter', construction: 'bottom_up_flat' }), constraints({ circumferenceCm: 24, lengthCm: 170 }));
  assert.equal(scarf.finishedDimensions.totalLengthCm, 170);
  assert.ok(Math.abs(scarf.calculatedGauge.castOnSts / 1.8 - 24) < 2);
});

test('sweaters get an honest swatch and a warning, never a hat', () => {
  const p = compilePattern(blueprint({ garmentType: 'pullover' }), constraints());
  assert.equal(p.sections.some((s) => s.id === 'crown'), false);
  assert.equal(p.warnings[0].severity, 'caution');
  assert.match(p.warnings[0].message, /cannot write a full/);
});

test('stockinette scarf gets a garter frame so that it does not curl', () => {
  const p = compileScarfPattern(blueprint({ garmentType: 'scarf', mainStitch: 'stockinette' }), constraints({ circumferenceCm: 24, lengthCm: 170 }));
  const body = p.sections.find((s) => s.id === 'full-scarf')!.instructions.filter((i) => i.kind === 'work');
  assert.ok(body.length >= 3);
  assert.ok(body[0].rows![0].ops.slice(1).every((o) => o === 'k'));
});

test('chart cells come from the same stitch data as the written rows', () => {
  const p = compileBeaniePattern(blueprint({ crownWedges: 4 }), constraints());
  const flat = p.chartData.cells.flat();
  assert.ok(flat.some((c) => c.stitchType === 'ssk'));
  assert.ok(flat.some((c) => c.stitchType === 'k2tog'));
  assert.ok(flat.some((c) => c.stitchType === 'P'));
  assert.equal(p.chartData.cols, 96 / 4);
});

test('row text folds repeats and keeps the stitch count', () => {
  assert.equal(rowToText(['k', 'p', 'k', 'p'], 'en'), '*K1, P1; rep from * to end');
  const ops = countRow(['ssk', 'p', 'k', 'k2tog', 'sm']);
  assert.deepEqual(ops, { consumed: 6, produced: 4 });
});

test('impossible rows are refused instead of written out', () => {
  // Very bulky gauge: a tiny stitch count must still cast on a valid multiple.
  const p = compileBeaniePattern(blueprint({ mainStitch: 'rib_2x2', crownWedges: 6 }), constraints({ gaugeSts10cm: 8, gaugeRows10cm: 10, circumferenceCm: 42, lengthCm: 16, yarnWeight: 'Super Bulky' }));
  assert.equal(p.calculatedGauge.castOnSts % 12, 0);
  assert.deepEqual(verifyPattern(p), []);
});
