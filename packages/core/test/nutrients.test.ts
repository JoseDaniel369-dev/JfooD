import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateNutrients,
  calculateSecondaryTargets,
  foodInputNutrientsSchema,
  makeNutrients,
  nutrientsPer100gSchema,
  sumNutrients,
  sumNutrientsKnown,
} from '../src/index.js';

const chickenPer100g = makeNutrients({
  caloriesKcal: 150,
  proteinGrams: 25,
  carbohydrateGrams: 0,
  fatGrams: 5,
});

test('calculates calories and macros for a portion in grams', () => {
  assert.deepEqual(
    calculateNutrients(chickenPer100g, 200),
    makeNutrients({ caloriesKcal: 300, proteinGrams: 50, carbohydrateGrams: 0, fatGrams: 10 }),
  );
});

test('preserves unknown nutrients instead of converting them to zero', () => {
  const result = calculateNutrients({ ...chickenPer100g, proteinGrams: null }, 100);

  assert.equal(result.proteinGrams, null);
  assert.equal(result.caloriesKcal, 150);
});

test('rejects invalid portions and invalid nutritional values', () => {
  assert.throws(() => calculateNutrients(chickenPer100g, 0));
  assert.throws(() => calculateNutrients(chickenPer100g, -10));
  assert.throws(() => calculateNutrients(chickenPer100g, Number.NaN));
  assert.throws(() => calculateNutrients({ ...chickenPer100g, caloriesKcal: -1 }, 100));
});

test('adds complete totals and marks incomplete totals as unknown', () => {
  const first = calculateNutrients(chickenPer100g, 200);
  const second = makeNutrients({
    caloriesKcal: 80,
    proteinGrams: null,
    carbohydrateGrams: 20,
    fatGrams: 0,
  });

  // The extras (fibre, sugars, salt) are unknown on both, so they stay unknown.
  assert.deepEqual(
    sumNutrients([first, second]),
    makeNutrients({ caloriesKcal: 380, proteinGrams: null, carbohydrateGrams: 20, fatGrams: 10 }),
  );
  assert.deepEqual(sumNutrients([]), {
    caloriesKcal: 0,
    proteinGrams: 0,
    carbohydrateGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
    sugarsGrams: 0,
    saltGrams: 0,
  });
});

test('sumNutrientsKnown reports known totals and how many values are missing', () => {
  const known = calculateNutrients(chickenPer100g, 200);
  const unknownCalories = makeNutrients({
    caloriesKcal: null,
    proteinGrams: 5,
    carbohydrateGrams: 10,
    fatGrams: 1,
  });

  const result = sumNutrientsKnown([known, unknownCalories]);

  assert.deepEqual(result.caloriesKcal, { knownTotal: 300, unknownCount: 1, complete: false });
  assert.deepEqual(result.proteinGrams, { knownTotal: 55, unknownCount: 0, complete: true });
});

test('sumNutrientsKnown never turns unknown into zero and handles empty days', () => {
  const allUnknown = makeNutrients();

  const unknownOnly = sumNutrientsKnown([allUnknown, allUnknown]);
  assert.equal(unknownOnly.caloriesKcal.unknownCount, 2);
  assert.equal(unknownOnly.caloriesKcal.complete, false);

  const empty = sumNutrientsKnown([]);
  assert.deepEqual(empty.caloriesKcal, { knownTotal: 0, unknownCount: 0, complete: true });
});

test('foodInputNutrientsSchema rejects physically impossible values typed by a person', () => {
  const ok = { caloriesKcal: 884, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 100 };

  assert.equal(foodInputNutrientsSchema.safeParse(ok).success, true);
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, caloriesKcal: 5000 }).success, false);
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, fatGrams: 150 }).success, false);
  assert.equal(
    foodInputNutrientsSchema.safeParse({ ...ok, proteinGrams: 60, carbohydrateGrams: 60, fatGrams: 0 }).success,
    false,
  );
  assert.equal(foodInputNutrientsSchema.safeParse(makeNutrients()).success, true);
  // The read-path schema is intentionally NOT tightened.
  assert.equal(nutrientsPer100gSchema.safeParse({ ...ok, caloriesKcal: 5000 }).success, true);
});

test('fibre, sugars and salt scale with the portion and stay unknown when missing', () => {
  const oats = makeNutrients({
    caloriesKcal: 370,
    proteinGrams: 13,
    carbohydrateGrams: 60,
    fatGrams: 7,
    fiberGrams: 10,
    sugarsGrams: 1,
  });

  const portion = calculateNutrients(oats, 50);
  assert.equal(portion.fiberGrams, 5);
  assert.equal(portion.sugarsGrams, 0.5);
  assert.equal(portion.saltGrams, null, 'salt was never given: unknown, not zero');
});

test('data saved before the extras existed still parses, with them unknown', () => {
  const old = { caloriesKcal: 100, proteinGrams: 1, carbohydrateGrams: 2, fatGrams: 3 };

  assert.deepEqual(nutrientsPer100gSchema.parse(old), {
    ...old,
    fiberGrams: null,
    sugarsGrams: null,
    saltGrams: null,
  });
});

test('sumNutrientsKnown covers the extras and counts the foods without them', () => {
  const withFibre = makeNutrients({ caloriesKcal: 100, fiberGrams: 4 });
  const withoutFibre = makeNutrients({ caloriesKcal: 100 });

  const total = sumNutrientsKnown([withFibre, withoutFibre]);
  assert.deepEqual(total.fiberGrams, { knownTotal: 4, unknownCount: 1, complete: false });
});

test('foodInputNutrientsSchema validates fibre, sugars and salt', () => {
  const ok = makeNutrients({ caloriesKcal: 380, proteinGrams: 6, carbohydrateGrams: 80, fatGrams: 1 });

  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, fiberGrams: 12, sugarsGrams: 20, saltGrams: 1.2 }).success, true);
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, saltGrams: 150 }).success, false);
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, fiberGrams: -1 }).success, false);
  // Sugars are part of the carbohydrates.
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, sugarsGrams: 81 }).success, false);
  assert.equal(foodInputNutrientsSchema.safeParse({ ...ok, sugarsGrams: 80.4 }).success, true);
  // Without carbohydrates to compare with, sugars are accepted on their own.
  assert.equal(foodInputNutrientsSchema.safeParse(makeNutrients({ sugarsGrams: 10 })).success, true);
});

test('secondary targets derive from the calorie goal and never go below the fibre minimum', () => {
  assert.deepEqual(calculateSecondaryTargets(2000), { fiberGrams: 28, sugarsGrams: 50, saltGrams: 5 });
  assert.equal(calculateSecondaryTargets(1200).fiberGrams, 25, 'fibre has a floor of 25 g');
  assert.equal(calculateSecondaryTargets(3000).sugarsGrams, 75);
  assert.equal(calculateSecondaryTargets(-5).sugarsGrams, 0);
});
