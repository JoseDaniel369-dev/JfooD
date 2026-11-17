import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeRecipe, type Nutrients } from '../src/index.js';

const rice: Nutrients = { caloriesKcal: 130, proteinGrams: 2.7, carbohydrateGrams: 28, fatGrams: 0.3 };
const oil: Nutrients = { caloriesKcal: 884, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 100 };
const unknown: Nutrients = { caloriesKcal: null, proteinGrams: 5, carbohydrateGrams: 10, fatGrams: 1 };

test('per-100 g values are the weighted sum divided by the total weight', () => {
  // 200 g rice (260 kcal) + 10 g oil (88.4 kcal) = 348.4 kcal over 210 g
  const result = computeRecipe([
    { per100g: rice, grams: 200 },
    { per100g: oil, grams: 10 },
  ]);

  assert.equal(result.totalGrams, 210);
  assert.equal(result.per100g.caloriesKcal, 165.9); // 348.4 / 210 * 100
  assert.equal(result.per100g.fatGrams, 5.05); // (0.6 + 10) / 210 * 100
});

test('a final cooked weight changes the density, not the total energy', () => {
  const dry = computeRecipe([{ per100g: rice, grams: 100 }]);
  const cooked = computeRecipe([{ per100g: rice, grams: 100 }], 250);

  assert.equal(dry.per100g.caloriesKcal, 130);
  assert.equal(cooked.per100g.caloriesKcal, 52); // 130 kcal over 250 g
  assert.equal(cooked.totalGrams, 250);
});

test('an unknown ingredient value makes only that nutrient unknown', () => {
  const result = computeRecipe([
    { per100g: rice, grams: 100 },
    { per100g: unknown, grams: 100 },
  ]);

  assert.equal(result.per100g.caloriesKcal, null);
  assert.equal(result.per100g.proteinGrams, 3.85);
});

test('empty recipes and invalid amounts are rejected', () => {
  assert.throws(() => computeRecipe([]), /al menos un ingrediente/);
  assert.throws(() => computeRecipe([{ per100g: rice, grams: 0 }]));
  assert.throws(() => computeRecipe([{ per100g: rice, grams: 100 }], -1));
});
