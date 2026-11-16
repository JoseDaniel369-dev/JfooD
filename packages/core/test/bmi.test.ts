import assert from 'node:assert/strict';
import test from 'node:test';

import { computeBmi } from '@jfood/core';

test('computeBmi returns null for invalid inputs', () => {
  assert.equal(computeBmi(0, 175), null);
  assert.equal(computeBmi(70, 0), null);
  assert.equal(computeBmi(NaN, 175), null);
});

test('computeBmi categorises BMI ranges', () => {
  assert.equal(computeBmi(50, 175)?.category, 'underweight');
  assert.equal(computeBmi(70, 175)?.category, 'normal');
  assert.equal(computeBmi(85, 175)?.category, 'overweight');
  assert.equal(computeBmi(100, 175)?.category, 'obesity');
});

test('computeBmi rounds to one decimal', () => {
  const bmi = computeBmi(70, 175);
  assert.equal(bmi?.value, 22.9);
});

test('computeBmi includes Spanish labels', () => {
  assert.equal(computeBmi(70, 175)?.label, 'Normal');
  assert.equal(computeBmi(85, 175)?.label, 'Sobrepeso');
});
