import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePattern } from '../engine/compiler';
import { KnitBlueprint, TrackerPosition } from '../types/knit';

// RowTracker.tsx pulls in React only for the view, so its pure helpers are safe to import here.
import { advance, retreat } from './RowTracker';

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

const pattern = compilePattern(blueprint, {
  targetSize: 'a',
  circumferenceCm: 56,
  lengthCm: 22,
  brimLengthCm: 7.5,
  gaugeSts10cm: 18,
  gaugeRows10cm: 24,
  easeCm: -4,
  needleSizeMm: 4.5,
  yarnWeight: 'Worsted / Aran',
  language: 'en',
});

test('one tap is one real round, not one line of the pattern', () => {
  const brim = pattern.allRows.findIndex((r) => r.kind === 'work');
  const count = pattern.allRows[brim].repeatCount!;
  assert.equal(count, 36);
  let pos: TrackerPosition = { stepIndex: brim, rowInStep: 0 };
  for (let i = 0; i < count - 1; i++) {
    pos = advance(pattern, pos);
    assert.equal(pos.stepIndex, brim);
  }
  assert.equal(pos.rowInStep, count - 1);
  pos = advance(pattern, pos);
  assert.deepEqual(pos, { stepIndex: brim + 1, rowInStep: 0 });
});

test('walking to the end and back returns to the start without losing a row', () => {
  let pos: TrackerPosition = { stepIndex: 0, rowInStep: 0 };
  let taps = 0;
  for (;;) {
    const next = advance(pattern, pos);
    if (next.stepIndex === pos.stepIndex && next.rowInStep === pos.rowInStep) break;
    pos = next;
    taps++;
  }
  const expected = pattern.allRows.reduce((acc, r) => acc + (r.kind === 'work' ? r.repeatCount ?? 1 : 1), 0) - 1;
  assert.equal(taps, expected);
  for (let i = 0; i < taps; i++) pos = retreat(pattern, pos);
  assert.deepEqual(pos, { stepIndex: 0, rowInStep: 0 });
  assert.deepEqual(retreat(pattern, pos), pos);
});
