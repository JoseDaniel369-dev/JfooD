import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DailyTotals } from '../../src/data/sqlite/repositories/summaryRepository';
import { averageMacros } from '../../src/features/progress/utils/macros';

function day(overrides: Partial<DailyTotals>): DailyTotals {
  return {
    localDate: '2026-11-20',
    entries: 3,
    caloriesKcal: 2000,
    proteinGrams: 100,
    carbohydrateGrams: 250,
    fatGrams: 60,
    fiberGrams: 25,
    caloriesPartial: false,
    ...overrides,
  };
}

test('an empty period has no averages and does not invent zeros', () => {
  const result = averageMacros([]);
  assert.equal(result.loggedDays, 0);
  assert.equal(result.protein.grams, null);
  assert.equal(result.protein.approximate, false);
  assert.equal(result.split, null);
});

test('complete days are averaged exactly and the energy split adds up to 100', () => {
  const result = averageMacros([
    day({ proteinGrams: 100, carbohydrateGrams: 200, fatGrams: 50 }),
    day({ localDate: '2026-11-21', proteinGrams: 140, carbohydrateGrams: 300, fatGrams: 70 }),
  ]);

  assert.equal(result.loggedDays, 2);
  assert.equal(result.protein.grams, 120);
  assert.equal(result.carbohydrates.grams, 250);
  assert.equal(result.fat.grams, 60);
  assert.equal(result.protein.approximate, false);

  // 480 + 1000 + 540 = 2020 kcal → 24 % / 50 % / 27 % (rounded) = 101, so the remainder fixes the last one.
  assert.ok(result.split);
  assert.equal(result.split.protein + result.split.carbohydrates + result.split.fat, 100);
  assert.equal(result.split.protein, 24);
  assert.equal(result.split.carbohydrates, 50);
});

test('a day without a value is left out of that mean and marks it as a minimum', () => {
  const result = averageMacros([
    day({ fiberGrams: 30 }),
    day({ localDate: '2026-11-21', fiberGrams: null }),
  ]);

  assert.equal(result.fiber.grams, 30, 'the unknown day is not counted as zero');
  assert.equal(result.fiber.approximate, true);
  assert.equal(result.protein.approximate, false);
});

test('days whose calories are incomplete mark every macro as a minimum', () => {
  const result = averageMacros([day({ caloriesPartial: true })]);

  assert.equal(result.protein.approximate, true);
  assert.equal(result.carbohydrates.approximate, true);
  assert.equal(result.fat.approximate, true);
});

test('when a macro is unknown on every day, there is no split and the macro is null', () => {
  const result = averageMacros([day({ proteinGrams: null }), day({ proteinGrams: null })]);

  assert.equal(result.protein.grams, null);
  assert.equal(result.protein.approximate, true);
  assert.equal(result.split, null);
});
