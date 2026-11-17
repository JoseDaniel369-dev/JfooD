import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sumNutrientsKnown, type Nutrients } from '@jfood/core';

import {
  describeUnknown,
  entryNutrients,
  formatPartialAmount,
  formatRemaining,
  remainingCalories,
  remainingLabel,
} from '../../src/features/diary/utils/totals';

const chicken: Nutrients = {
  caloriesKcal: 150,
  proteinGrams: 25,
  carbohydrateGrams: 0,
  fatGrams: 5,
};
const unknown: Nutrients = {
  caloriesKcal: null,
  proteinGrams: null,
  carbohydrateGrams: null,
  fatGrams: null,
};

test('entryNutrients scales per-100 g values and degrades to unknown on bad rows', () => {
  assert.equal(entryNutrients(chicken, 200).caloriesKcal, 300);
  assert.equal(entryNutrients(chicken, 0).caloriesKcal, null);
  assert.equal(entryNutrients({ ...chicken, caloriesKcal: -5 }, 100).caloriesKcal, null);
});

test('a complete total is shown plainly and an incomplete one with ≥', () => {
  const complete = sumNutrientsKnown([entryNutrients(chicken, 200)]);
  assert.equal(formatPartialAmount(complete.caloriesKcal), '300');
  assert.equal(describeUnknown(complete.caloriesKcal), null);

  const partial = sumNutrientsKnown([entryNutrients(chicken, 200), unknown]);
  assert.equal(formatPartialAmount(partial.caloriesKcal), '≥ 300');
  assert.equal(formatPartialAmount(sumNutrientsKnown([unknown]).caloriesKcal), '—');
  assert.equal(describeUnknown(partial.caloriesKcal), '1 alimento sin calorías');

  const two = sumNutrientsKnown([unknown, unknown]);
  assert.equal(describeUnknown(two.caloriesKcal), '2 alimentos sin calorías');
});

test('remaining calories are exact for complete days and bounds otherwise', () => {
  const complete = sumNutrientsKnown([entryNutrients(chicken, 200)]).caloriesKcal;
  const exact = remainingCalories(2000, complete);
  assert.deepEqual(exact, { amount: 1700, over: false, approximate: false });
  assert.equal(remainingLabel(exact), 'Restantes');
  assert.equal(formatRemaining(exact), '1700 kcal');

  const partial = sumNutrientsKnown([entryNutrients(chicken, 200), unknown]).caloriesKcal;
  const bound = remainingCalories(2000, partial);
  assert.equal(remainingLabel(bound), 'Restantes (como máximo)');
  assert.equal(formatRemaining(bound), '≤ 1700 kcal');

  const certainlyOver = remainingCalories(200, partial);
  assert.equal(certainlyOver.over, true);
  assert.equal(remainingLabel(certainlyOver), 'Por encima del objetivo');
  assert.equal(formatRemaining(certainlyOver), '≥ 100 kcal');
});
