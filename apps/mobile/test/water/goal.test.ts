import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_GOAL_ML,
  parseWaterAmount,
  parseWaterGoal,
} from '@/features/water/utils/goal';

test('parseWaterGoal rejects non-numeric values', () => {
  assert.equal(parseWaterGoal('abc'), null);
  assert.equal(parseWaterGoal(''), null);
});

test('parseWaterGoal clamps to a safe range', () => {
  assert.equal(parseWaterGoal('100'), 250);
  assert.equal(parseWaterGoal('10000'), 6000);
});

test('parseWaterGoal accepts valid values', () => {
  assert.equal(parseWaterGoal('2000'), 2000);
  assert.equal(parseWaterGoal('2500'), 2500);
  assert.equal(parseWaterGoal('250,5'), 251);
  assert.equal(parseWaterGoal('2.000'), 2000);
  assert.equal(parseWaterGoal('2.500'), 2500);
  assert.equal(parseWaterGoal('1.000.000'), MAX_GOAL_ML);
});

test('parseWaterAmount reads a plain amount in millilitres and refuses anything else', () => {
  assert.equal(parseWaterAmount('330'), 330);
  assert.equal(parseWaterAmount(' 330 ml '), 330);
  assert.equal(parseWaterAmount('1,5'), 2, 'a decimal is rounded to whole millilitres');
  assert.equal(parseWaterAmount('5000'), 5000);

  for (const bad of ['', '   ', 'abc', '0', '-5', '5001', 'Infinity']) {
    assert.equal(parseWaterAmount(bad), null, bad);
  }
});
