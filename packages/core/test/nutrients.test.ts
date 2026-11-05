import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateNutrients, sumNutrients, type Nutrients } from '../src/index.js';

const chickenPer100g: Nutrients = {
  caloriesKcal: 150,
  proteinGrams: 25,
  carbohydrateGrams: 0,
  fatGrams: 5,
};

test('calculates calories and macros for a portion in grams', () => {
  assert.deepEqual(calculateNutrients(chickenPer100g, 200), {
    caloriesKcal: 300,
    proteinGrams: 50,
    carbohydrateGrams: 0,
    fatGrams: 10,
  });
});

test('preserves unknown nutrients instead of converting them to zero', () => {
  const result = calculateNutrients(
    { ...chickenPer100g, proteinGrams: null },
    100,
  );

  assert.equal(result.proteinGrams, null);
  assert.equal(result.caloriesKcal, 150);
});

test('rejects invalid portions and invalid nutritional values', () => {
  assert.throws(() => calculateNutrients(chickenPer100g, 0));
  assert.throws(() => calculateNutrients(chickenPer100g, -10));
  assert.throws(() => calculateNutrients(chickenPer100g, Number.NaN));
  assert.throws(() =>
    calculateNutrients({ ...chickenPer100g, caloriesKcal: -1 }, 100),
  );
});

test('adds complete totals and marks incomplete totals as unknown', () => {
  const first = calculateNutrients(chickenPer100g, 200);
  const second: Nutrients = {
    caloriesKcal: 80,
    proteinGrams: null,
    carbohydrateGrams: 20,
    fatGrams: 0,
  };

  assert.deepEqual(sumNutrients([first, second]), {
    caloriesKcal: 380,
    proteinGrams: null,
    carbohydrateGrams: 20,
    fatGrams: 10,
  });
  assert.deepEqual(sumNutrients([]), {
    caloriesKcal: 0,
    proteinGrams: 0,
    carbohydrateGrams: 0,
    fatGrams: 0,
  });
});
