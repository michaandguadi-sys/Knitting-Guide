import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePattern } from './compiler';
import { resolvePattern, sameMeasurements } from './resolvePattern';
import { CompiledPattern, KnitBlueprint, KnitUserConstraints } from '../types/knit';

const blueprint: KnitBlueprint = {
  garmentType: 'beanie',
  title: 't',
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
};

const constraints: KnitUserConstraints = {
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

/** A pattern as an earlier version wrote it: different words and a different number of steps. */
function oldVersion(): CompiledPattern {
  const pattern = compilePattern(blueprint, constraints);
  return {
    ...pattern,
    title: 'Written by an older version',
    allRows: pattern.allRows.slice(0, 5).map((row) => ({ ...row, instruction: 'old instruction' })),
  };
}

test('a saved project keeps its own instructions when the app improves', () => {
  const saved = oldVersion();
  assert.equal(resolvePattern(saved, blueprint, constraints, 'en'), saved);
});

test('changing the size or gauge rebuilds it, because the knitter asked for different numbers', () => {
  const saved = oldVersion();
  const rebuilt = resolvePattern(saved, blueprint, { ...constraints, gaugeSts10cm: 22 }, 'en');
  assert.notEqual(rebuilt, saved);
  assert.equal(rebuilt.constraints.gaugeSts10cm, 22);
});

test('a project from this version can be translated, and its steps still line up', () => {
  const saved = compilePattern(blueprint, constraints);
  const translated = resolvePattern(saved, blueprint, constraints, 'es');
  assert.notEqual(translated, saved);
  assert.equal(translated.allRows.length, saved.allRows.length);
  assert.ok(translated.title.includes('Gorro'));
});

test('an older project whose steps differ stays in its language rather than losing its place', () => {
  const saved = oldVersion();
  assert.equal(resolvePattern(saved, blueprint, constraints, 'es'), saved);
});

test('without a saved project the pattern is simply written', () => {
  assert.equal(resolvePattern(null, blueprint, constraints, 'es').constraints.language, 'es');
});

test('language alone does not count as changing the measurements', () => {
  assert.equal(sameMeasurements(constraints, { ...constraints, language: 'es' }), true);
  assert.equal(sameMeasurements(constraints, { ...constraints, lengthCm: 23 }), false);
});
