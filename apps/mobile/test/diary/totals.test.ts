import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeNutrients, sumNutrientsKnown, type Nutrients } from '@jfood/core';

import {
  describeUnknown,
  entryNutrients,
  describeExtras,
  formatGrams,
  formatPartialAmount,
  formatRemaining,
  remainingCalories,
  remainingLabel,
} from '../../src/features/diary/utils/totals';

const chicken: Nutrients = makeNutrients({
  caloriesKcal: 150,
  proteinGrams: 25,
  carbohydrateGrams: 0,
  fatGrams: 5,
});
const unknown: Nutrients = makeNutrients();

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

test('formatGrams uses a decimal comma and drops decimals from 10 g', () => {
  assert.equal(formatGrams(3.14), '3,1');
  assert.equal(formatGrams(0.04), '0');
  assert.equal(formatGrams(27.6), '28');
  assert.equal(formatGrams(5), '5');
});

test('describeExtras compares fibre, sugars and salt with their references', () => {
  const eaten = sumNutrientsKnown([
    makeNutrients({ fiberGrams: 12, sugarsGrams: 30, saltGrams: 6 }),
    makeNutrients({ fiberGrams: 8, sugarsGrams: 25, saltGrams: 1 }),
  ]);
  const rows = describeExtras(eaten, { fiberGrams: 28, sugarsGrams: 50, saltGrams: 5 }, true);

  assert.deepEqual(
    rows.map((row) => [row.key, row.amount, row.target, row.exceeded]),
    [
      ['fiberGrams', '20', '28 g mín.', false],
      ['sugarsGrams', '55', '50 g máx.', true],
      ['saltGrams', '7', '5 g máx.', true],
    ],
  );
});

test('describeExtras never invents zeros: unknown nutrients are left out or marked as a minimum', () => {
  const targets = { fiberGrams: 28, sugarsGrams: 50, saltGrams: 5 };

  // Nothing logged → nothing to show.
  assert.deepEqual(describeExtras(sumNutrientsKnown([]), targets, false), []);

  // Entries exist but fibre/sugars/salt are all unknown → not shown as 0.
  const unknownOnly = sumNutrientsKnown([makeNutrients({ caloriesKcal: 100 })]);
  assert.deepEqual(describeExtras(unknownOnly, targets, true), []);

  // One food with fibre and one without → a lower bound.
  const mixed = sumNutrientsKnown([
    makeNutrients({ fiberGrams: 4 }),
    makeNutrients({ caloriesKcal: 90 }),
  ]);
  const [fibre] = describeExtras(mixed, targets, true);
  assert.equal(fibre?.amount, '≥ 4');
});
