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
  assert.equal(parseWaterAmount('5000'), 5000);
  assert.equal(parseWaterAmount('1.500'), 1500, 'a Spanish thousands separator');
  assert.equal(parseWaterAmount('1.500 ml'), 1500);

  // "1,5" could be litres: it is refused instead of saved as 2 ml.
  for (const bad of ['', '   ', 'abc', '0', '-5', '5001', 'Infinity', '1,5', '1e3', '0x10']) {
    assert.equal(parseWaterAmount(bad), null, bad);
  }
});
