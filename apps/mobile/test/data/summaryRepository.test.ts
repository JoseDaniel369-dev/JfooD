import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addEntry } from '../../src/data/sqlite/repositories/diaryRepository';
import { createFood } from '../../src/data/sqlite/repositories/foodRepository';
import {
  countWaterGoalDays,
  getAchievementStats,
  getDailyTotals,
  getWaterTotals,
} from '../../src/data/sqlite/repositories/summaryRepository';
import { upsertWeightLog } from '../../src/data/sqlite/repositories/weightRepository';
import { addWater } from '../../src/data/sqlite/repositories/waterRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

test('getDailyTotals sums each nutrient per day and never turns unknown into zero', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const oats = await createFood(sqlite, { name: 'Avena', caloriesKcal: 370, proteinGrams: 13, fiberGrams: 10 });
  const mystery = await createFood(sqlite, { name: 'Misterio' });

  await addEntry(sqlite, { localDate: '2026-11-16', mealType: 'breakfast', food: oats, grams: 50 });
  await addEntry(sqlite, { localDate: '2026-11-16', mealType: 'lunch', food: mystery, grams: 100 });
  await addEntry(sqlite, { localDate: '2026-11-17', mealType: 'lunch', food: mystery, grams: 100 });
  await addEntry(sqlite, { localDate: '2026-11-30', mealType: 'lunch', food: oats, grams: 100 });

  const days = await getDailyTotals(sqlite, '2026-11-16', '2026-11-22');
  assert.deepEqual(days.map((d) => d.localDate), ['2026-11-16', '2026-11-17']);

  const [first, second] = days;
  assert.equal(first?.entries, 2);
  assert.equal(first?.caloriesKcal, 185, 'known calories are summed');
  assert.equal(first?.caloriesPartial, true, 'but the day is flagged as a minimum');
  assert.equal(first?.fiberGrams, 5);
  assert.equal(second?.caloriesKcal, null, 'a day with nothing known is null, not 0');
  assert.equal(second?.proteinGrams, null);

  await assert.rejects(getDailyTotals(sqlite, 'x', '2026-11-22'), /fecha/);
});

test('getAchievementStats counts entries, days with all four meals, foods and recipes', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const rice = await createFood(sqlite, { name: 'Arroz', caloriesKcal: 130 });
  const stew = await createFood(sqlite, { name: 'Guiso', brand: 'Receta', caloriesKcal: 90 });

  for (const mealType of ['breakfast', 'lunch', 'snack', 'dinner'] as const) {
    await addEntry(sqlite, { localDate: '2026-11-10', mealType, food: rice, grams: 100 });
  }
  await addEntry(sqlite, { localDate: '2026-11-11', mealType: 'lunch', food: stew, grams: 200 });
  await upsertWeightLog(sqlite, { localDate: '2026-11-10', weightKg: 70 });

  const stats = await getAchievementStats(sqlite);
  assert.equal(stats.totalEntries, 5);
  assert.deepEqual(stats.loggedDates, ['2026-11-10', '2026-11-11']);
  assert.equal(stats.daysWithAllMeals, 1);
  assert.equal(stats.distinctFoods, 2);
  assert.equal(stats.recipes, 1);
  assert.deepEqual(stats.weightDates, ['2026-11-10']);
});

test('an empty database gives zeros, not errors', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  assert.deepEqual(await getAchievementStats(sqlite), {
    totalEntries: 0,
    loggedDates: [],
    daysWithAllMeals: 0,
    distinctFoods: 0,
    recipes: 0,
    weightDates: [],
  });
  assert.deepEqual(await getDailyTotals(sqlite, '2026-11-01', '2026-11-30'), []);
});

test('water totals per day and the number of days that reached the goal', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();

  await addWater(sqlite, '2026-11-16', 1500);
  await addWater(sqlite, '2026-11-16', 600);
  await addWater(sqlite, '2026-11-17', 800);
  await addWater(sqlite, '2026-11-30', 3000);

  assert.deepEqual(await getWaterTotals(sqlite, '2026-11-16', '2026-11-22'), {
    '2026-11-16': 2100,
    '2026-11-17': 800,
  });
  assert.equal(await countWaterGoalDays(sqlite, 2000), 2);
  assert.equal(await countWaterGoalDays(sqlite, 5000), 0);
});

test('entries on future days do not count as logged (streaks and achievements)', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const rice = await createFood(sqlite, { name: 'Arroz', caloriesKcal: 130 });

  await addEntry(sqlite, { localDate: '2026-11-10', mealType: 'lunch', food: rice, grams: 100 });
  // A week copied ahead of time.
  for (const localDate of ['2026-11-12', '2026-11-13', '2026-11-14']) {
    for (const mealType of ['breakfast', 'lunch', 'snack', 'dinner'] as const) {
      await addEntry(sqlite, { localDate, mealType, food: rice, grams: 100 });
    }
  }

  const stats = await getAchievementStats(sqlite, '2026-11-10');
  assert.equal(stats.totalEntries, 1);
  assert.deepEqual(stats.loggedDates, ['2026-11-10']);
  assert.equal(stats.daysWithAllMeals, 0);
  assert.equal(stats.distinctFoods, 1);
});
