import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeNutrients, sumNutrientsKnown } from '@jfood/core';

import {
  MAX_INSIGHTS,
  buildInsights,
  type InsightInput,
} from '../../src/features/insights/buildInsights';

const goals = { caloriesKcal: 2000, proteinGrams: 120, carbohydrateGrams: 230, fatGrams: 60 };
const targets = { fiberGrams: 28, sugarsGrams: 50, saltGrams: 5 };

function input(overrides: Partial<InsightInput> & { eaten?: Parameters<typeof makeNutrients>[0][] } = {}): InsightInput {
  const { eaten = [], ...rest } = overrides;
  return {
    hour: 12,
    goals,
    targets,
    consumed: sumNutrientsKnown(eaten.map((values) => makeNutrients(values))),
    mealEntries: { breakfast: 1, lunch: 1, snack: 0, dinner: 0 },
    waterMl: 1500,
    waterGoalMl: 2000,
    streakDays: 3,
    ...rest,
  };
}

const kinds = (list: ReturnType<typeof buildInsights>) => list.map((tip) => tip.kind);

test('a normal midday with everything in order has nothing to say', () => {
  assert.deepEqual(
    buildInsights(input({ eaten: [{ caloriesKcal: 900, proteinGrams: 60 }] })),
    [],
  );
});

test('finishing the day within 10 % of the goal is celebrated', () => {
  const tips = buildInsights(
    input({
      hour: 21,
      eaten: [{ caloriesKcal: 1950, proteinGrams: 110, fiberGrams: 30 }],
      mealEntries: { breakfast: 1, lunch: 1, snack: 1, dinner: 1 },
    }),
  );
  assert.equal(tips[0]?.kind, 'goal-reached');
  assert.equal(tips[0]?.tone, 'success');
  assert.match(tips[0]!.message, /1950 de 2000/);
});

test('the day is never "done" while some foods have no calories', () => {
  const partial = sumNutrientsKnown([
    makeNutrients({ caloriesKcal: 1950 }),
    makeNutrients({ caloriesKcal: null }),
  ]);
  const tips = buildInsights(input({ hour: 21, consumed: partial, mealEntries: { breakfast: 1, lunch: 1, snack: 0, dinner: 1 } }));
  assert.equal(kinds(tips).includes('goal-reached'), false);
});

test('going clearly over the goal is told kindly, with the amount', () => {
  const tips = buildInsights(input({ hour: 21, eaten: [{ caloriesKcal: 2500, proteinGrams: 130 }] }));
  const over = tips.find((tip) => tip.kind === 'over-goal');
  assert.equal(over?.title, 'Te has pasado 500 kcal');
  assert.match(over!.message, /No pasa nada/);
});

test('a streak with nothing logged late in the evening is flagged, singular or plural', () => {
  const empty = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
  assert.equal(buildInsights(input({ hour: 20, streakDays: 5, mealEntries: empty }))[0]?.title, 'Tu racha de 5 días está en juego');
  assert.equal(buildInsights(input({ hour: 20, streakDays: 1, mealEntries: empty }))[0]?.title, 'Tu racha de 1 día está en juego');
  assert.equal(kinds(buildInsights(input({ hour: 20, streakDays: 0, mealEntries: empty }))).includes('streak-at-risk'), false);
  assert.equal(kinds(buildInsights(input({ hour: 15, streakDays: 5, mealEntries: empty }))).includes('streak-at-risk'), false);
});

test('a meal that is overdue is mentioned once, the earliest one first', () => {
  const tips = buildInsights(
    input({ hour: 17, eaten: [{ caloriesKcal: 300 }], mealEntries: { breakfast: 0, lunch: 0, snack: 1, dinner: 0 } }),
  );
  const missing = tips.filter((tip) => tip.kind === 'missing-meal');
  assert.equal(missing.length, 1);
  assert.match(missing[0]!.title, /el desayuno/);
});

test('protein is only "short" late in the day and counts what is known, not unknowns as zero', () => {
  const late = buildInsights(input({ hour: 18, eaten: [{ caloriesKcal: 1500, proteinGrams: 40 }] }));
  assert.equal(late.find((tip) => tip.kind === 'protein')?.title, 'Te faltan 80 g de proteína');

  assert.equal(kinds(buildInsights(input({ hour: 12, eaten: [{ proteinGrams: 10 }] }))).includes('protein'), false);
  assert.equal(kinds(buildInsights(input({ hour: 18, eaten: [{ proteinGrams: 100 }] }))).includes('protein'), false);
});

test('water: a reminder when behind in the afternoon, a cheer when the goal is reached', () => {
  const behind = buildInsights(input({ hour: 17, waterMl: 400, eaten: [{ proteinGrams: 100 }] }));
  assert.equal(behind.find((tip) => tip.kind === 'water')?.tone, 'info');

  const done = buildInsights(input({ hour: 10, waterMl: 2100, eaten: [{ proteinGrams: 100 }] }));
  assert.equal(done.find((tip) => tip.kind === 'water')?.tone, 'success');

  assert.equal(kinds(buildInsights(input({ hour: 17, waterMl: 400, waterGoalMl: 0, eaten: [{ proteinGrams: 100 }] }))).includes('water'), false);
});

test('fibre is judged only when something about it is known', () => {
  const known = buildInsights(input({ hour: 21, eaten: [{ caloriesKcal: 1800, proteinGrams: 110, fiberGrams: 8 }], mealEntries: { breakfast: 1, lunch: 1, snack: 0, dinner: 1 } }));
  assert.ok(kinds(known).includes('fiber'));

  const unknown = buildInsights(input({ hour: 21, eaten: [{ caloriesKcal: 1800, proteinGrams: 110 }], mealEntries: { breakfast: 1, lunch: 1, snack: 0, dinner: 1 } }));
  assert.equal(kinds(unknown).includes('fiber'), false);
});

test('an empty morning gets a friendly nudge, and no negative tips', () => {
  const tips = buildInsights(input({ hour: 8, mealEntries: { breakfast: 0, lunch: 0, snack: 0, dinner: 0 }, streakDays: 0 }));
  assert.deepEqual(kinds(tips), ['start-day']);
});

test('never more tips than the limit, with the most important first', () => {
  const tips = buildInsights(
    input({
      hour: 22,
      streakDays: 4,
      waterMl: 100,
      eaten: [{ caloriesKcal: 3000, proteinGrams: 20, fiberGrams: 3 }],
      mealEntries: { breakfast: 0, lunch: 1, snack: 0, dinner: 0 },
    }),
  );
  assert.equal(tips.length, MAX_INSIGHTS);
  assert.equal(tips[0]?.kind, 'over-goal');
});
