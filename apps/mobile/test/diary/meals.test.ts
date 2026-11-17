import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defaultMealForHour } from '../../src/features/diary/utils/meals';

test('default meal follows the time of day', () => {
  assert.equal(defaultMealForHour(5), 'breakfast');
  assert.equal(defaultMealForHour(10), 'breakfast');
  assert.equal(defaultMealForHour(11), 'lunch');
  assert.equal(defaultMealForHour(15), 'lunch');
  assert.equal(defaultMealForHour(16), 'snack');
  assert.equal(defaultMealForHour(19), 'snack');
  assert.equal(defaultMealForHour(20), 'dinner');
  assert.equal(defaultMealForHour(23), 'dinner');
  assert.equal(defaultMealForHour(2), 'dinner');
});
