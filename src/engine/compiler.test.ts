import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lcm,
  roundToMultiple,
  compileBeaniePattern,
  compileScarfPattern,
} from './compiler';
import { KnitBlueprint, KnitUserConstraints } from '../types/knit';

test('lcm and roundToMultiple correctly enforce knitting repeat constraints', () => {
  assert.equal(lcm(2, 8), 8);
  assert.equal(lcm(4, 8), 8);
  assert.equal(lcm(4, 12), 12);

  assert.equal(roundToMultiple(91, 8), 88);
  assert.equal(roundToMultiple(93, 8), 96);
  assert.equal(roundToMultiple(83, 8), 80);
});

test('compileBeaniePattern in Spanish generates authentic Argentine knitting terms', () => {
  const sampleBlueprint: KnitBlueprint = {
    garmentType: 'beanie',
    title: 'The North Face Striped Ribbed Beanie',
    description: 'Gorro elástico a rayas verticales',
    construction: 'in_the_round',
    mainStitch: 'rib_1x1',
    hasFoldedBrim: true,
    brimHeightRatio: 0.35,
    crownWedges: 4,
    colorworkType: 'vertical_stripes',
    stripes: [
      { colorName: 'Verde Salvia', hex: '#637A67', widthStsEstimate: 8, role: 'base' },
      { colorName: 'Blanco Crema', hex: '#EDECE4', widthStsEstimate: 2, role: 'stripe' },
      { colorName: 'Oliva Profundo', hex: '#374536', widthStsEstimate: 2, role: 'accent' },
    ],
    features: ['Puño doblado', '4 gajos simétricos'],
    suggestedYarnWeight: 'Worsted / Aran',
    suggestedNeedleMm: 4.5,
    difficulty: 'Intermediate',
    confidenceScore: 0.96,
  };

  const sampleConstraintsEs: KnitUserConstraints = {
    targetSize: 'adult_m',
    circumferenceCm: 56,
    lengthCm: 22,
    brimLengthCm: 7.5,
    gaugeSts10cm: 18,
    gaugeRows10cm: 24,
    easeCm: -4,
    needleSizeMm: 4.5,
    yarnWeight: 'Worsted / Aran',
    language: 'es',
  };

  const patternEs = compileBeaniePattern(sampleBlueprint, sampleConstraintsEs);

  // Cast on calculation: 52 * 1.8 = 93.6 -> nearest multiple of 8 is 96
  assert.equal(patternEs.calculatedGauge.castOnSts, 96);
  assert.equal(patternEs.sections.length, 3);

  // Verify Spanish terminology
  assert.ok(patternEs.title.includes('Gorro'));
  assert.ok(patternEs.sections[0].title.includes('Montaje'));
  assert.ok(patternEs.sections[2].title.includes('Disminuciones'));

  // Check row instructions in Spanish
  const firstInst = patternEs.sections[0].instructions[0].instruction;
  assert.ok(firstInst.includes('agujas circulares de 4.5 mm'));
  assert.ok(firstInst.includes('montar 96 puntos'));
  assert.ok(firstInst.includes('marcador de inicio de vuelta'));

  const decInst = patternEs.sections[2].instructions.find((i) =>
    i.instruction.includes('surjete simple')
  );
  assert.ok(decInst, 'Decrease instruction must contain "surjete simple"');
  assert.ok(decInst.instruction.includes('2 puntos juntos al derecho'));

  // Verify abbreviations in Spanish
  const abbrList = patternEs.abbreviations.map((a) => a.abbr);
  assert.ok(abbrList.includes('2pjD'));
  assert.ok(abbrList.includes('SS'));
  assert.ok(abbrList.includes('MIV'));
});

test('compileBeaniePattern in English generates Craft Yarn Council notation', () => {
  const sampleBlueprint: KnitBlueprint = {
    garmentType: 'beanie',
    title: 'The North Face Striped Ribbed Beanie',
    description: 'Folded brim beanie with 4-wedge crown decreases',
    construction: 'in_the_round',
    mainStitch: 'rib_1x1',
    hasFoldedBrim: true,
    brimHeightRatio: 0.35,
    crownWedges: 4,
    colorworkType: 'vertical_stripes',
    features: ['1x1 rib', '4-wedge crown'],
    suggestedYarnWeight: 'Worsted / Aran',
    suggestedNeedleMm: 4.5,
    difficulty: 'Intermediate',
    confidenceScore: 0.96,
  };

  const sampleConstraintsEn: KnitUserConstraints = {
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
  };

  const patternEn = compileBeaniePattern(sampleBlueprint, sampleConstraintsEn);

  assert.equal(patternEn.calculatedGauge.castOnSts, 96);
  assert.ok(patternEn.sections[0].title.includes('Cast On'));
  assert.ok(patternEn.sections[0].instructions[0].instruction.includes('cast on 96 sts'));

  const decInst = patternEn.sections[2].instructions.find((i) =>
    i.instruction.includes('SSK')
  );
  assert.ok(decInst);
  assert.ok(decInst.instruction.includes('k2tog'));
});
