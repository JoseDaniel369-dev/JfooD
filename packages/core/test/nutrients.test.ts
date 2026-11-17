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

test('sumNutrientsKnown reports known totals and how many values are missing', async () => {
  const { sumNutrientsKnown } = await import('../src/index.js');
  const known = calculateNutrients(chickenPer100g, 200);
  const unknownCalories: Nutrients = {
    caloriesKcal: null,
    proteinGrams: 5,
    carbohydrateGrams: 10,
    fatGrams: 1,
  };

  const result = sumNutrientsKnown([known, unknownCalories]);

  assert.deepEqual(result.caloriesKcal, { knownTotal: 300, unknownCount: 1, complete: false });
  assert.deepEqual(result.proteinGrams, { knownTotal: 55, unknownCount: 0, complete: true });
});

test('sumNutrientsKnown never turns unknown into zero and handles empty days', async () => {
  const { sumNutrientsKnown } = await import('../src/index.js');
  const allUnknown: Nutrients = {
    caloriesKcal: null,
    proteinGrams: null,
    carbohydrateGrams: null,
    fatGrams: null,
  };

  const unknownOnly = sumNutrientsKnown([allUnknown, allUnknown]);
  assert.equal(unknownOnly.caloriesKcal.unknownCount, 2);
  assert.equal(unknownOnly.caloriesKcal.complete, false);

  const empty = sumNutrientsKnown([]);
  assert.deepEqual(empty.caloriesKcal, { knownTotal: 0, unknownCount: 0, complete: true });
});

test('foodInputNutrientsSchema rejects physically impossible values typed by a person', async () => {
  const { foodInputNutrientsSchema, nutrientsPer100gSchema } = await import('../src/index.js');
  const ok = { caloriesKcal: 884, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 100 };

  assert.equal(foodInputNutrientsSchema.safeParse(ok).success, true);
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, caloriesKcal: 5000 }).success, false);
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, fatGrams: 150 }).success, false);
  assert.equal(
    foodInputNutrientsSchema.safeParse({ ...ok, proteinGrams: 60, carbohydrateGrams: 60, fatGrams: 0 }).success,
    false,
  );
  assert.equal(
    foodInputNutrientsSchema.safeParse({ caloriesKcal: null, proteinGrams: null, carbohydrateGrams: null, fatGrams: null }).success,
    true,
  );
  // The read-path schema is intentionally NOT tightened.
  assert.equal(nutrientsPer100gSchema.safeParse({ ...ok, caloriesKcal: 5000 }).success, true);
});
