import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addEntry,
  duplicateEntry,
  getDiaryDay,
  getFrequentFoodsForMeal,
  removeEntry,
  restoreEntry,
} from '../../src/data/sqlite/repositories/diaryRepository';
import { createFood, deleteFood } from '../../src/data/sqlite/repositories/foodRepository';
import {
  addPlanEntry,
  duplicatePlanEntry,
  getPlanDay,
  removePlanEntry,
  restorePlanEntry,
} from '../../src/data/sqlite/repositories/planRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

const DATE = '2026-11-01';

async function setup() {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const rice = await createFood(sqlite, {
    name: 'Arroz',
    caloriesKcal: 130,
    proteinGrams: 2.7,
    carbohydrateGrams: 28,
    fatGrams: 0.3,
    fiberGrams: 0.4,
  });
  return { sqlite, rice };
}

test('deleting an entry and undoing it restores it exactly, in the same place', async () => {
  const { sqlite, rice } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: rice, grams: 100 });
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: rice, grams: 250 });
  const before = await getDiaryDay(sqlite, DATE);
  // Both entries may share a millisecond, so pick by amount, not by position.
  const first = before.entries.find((entry) => entry.grams === 100)!;

  const snapshot = await removeEntry(sqlite, first.id);
  assert.equal(snapshot?.grams, 100);
  assert.equal((await getDiaryDay(sqlite, DATE)).entries.length, 1);

  await restoreEntry(sqlite, snapshot!);

  const after = await getDiaryDay(sqlite, DATE);
  assert.deepEqual(after.entries, before.entries, 'same id, order, amounts and snapshot');
  assert.deepEqual(after.consumed, before.consumed);
});

test('removing something that is already gone is harmless', async () => {
  const { sqlite } = await setup();
  assert.equal(await removeEntry(sqlite, 'nope'), null);
});

test('undoing after the food was deleted keeps the entry with its own snapshot', async () => {
  const { sqlite, rice } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'dinner', food: rice, grams: 100 });
  const entry = (await getDiaryDay(sqlite, DATE)).entries[0]!;

  const snapshot = await removeEntry(sqlite, entry.id);
  await deleteFood(sqlite, rice.id);
  await restoreEntry(sqlite, snapshot!);

  const day = await getDiaryDay(sqlite, DATE);
  assert.equal(day.entries.length, 1);
  assert.equal(day.consumed.caloriesKcal, 130);
});

test('undoing a delete on a day that lost its meal row recreates it', async () => {
  const { sqlite, rice } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'snack', food: rice, grams: 50 });
  const entry = (await getDiaryDay(sqlite, DATE)).entries[0]!;

  const snapshot = await removeEntry(sqlite, entry.id);
  await sqlite.runAsync('DELETE FROM diary_meals');
  await restoreEntry(sqlite, snapshot!);

  assert.equal((await getDiaryDay(sqlite, DATE)).meals.snack.entries.length, 1);
});

test('duplicating an entry adds an identical one, with a new id, in the same meal', async () => {
  const { sqlite, rice } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: rice, grams: 150 });
  const original = (await getDiaryDay(sqlite, DATE)).entries[0]!;

  assert.equal(await duplicateEntry(sqlite, original.id), true);

  const day = await getDiaryDay(sqlite, DATE);
  assert.equal(day.entries.length, 2);
  const copy = day.entries.find((entry) => entry.id !== original.id)!;
  assert.equal(copy.mealType, 'lunch');
  assert.equal(copy.grams, 150);
  assert.deepEqual(copy.per100g, original.per100g, 'the nutrient snapshot is copied, extras included');
  assert.equal(day.consumed.fiberGrams, 1.2);

  assert.equal(await duplicateEntry(sqlite, 'nope'), false);
});

test('plan entries can be removed, restored and duplicated too', async () => {
  const { sqlite, rice } = await setup();
  await addPlanEntry(sqlite, { localDate: DATE, mealType: 'dinner', food: rice, grams: 200 });
  const entry = (await getPlanDay(sqlite, DATE)).entries[0]!;

  const snapshot = await removePlanEntry(sqlite, entry.id);
  assert.equal((await getPlanDay(sqlite, DATE)).entries.length, 0);
  await restorePlanEntry(sqlite, snapshot!);
  assert.deepEqual((await getPlanDay(sqlite, DATE)).entries, [entry]);

  assert.equal(await duplicatePlanEntry(sqlite, entry.id), true);
  const day = await getPlanDay(sqlite, DATE);
  assert.equal(day.entries.length, 2);
  assert.equal(day.consumed.caloriesKcal, 520);
  assert.equal(await removePlanEntry(sqlite, 'nope'), null);
  assert.equal(await duplicatePlanEntry(sqlite, 'nope'), false);
});

test('getFrequentFoodsForMeal ranks by how often a food is eaten in that meal', async () => {
  const { sqlite, rice } = await setup();
  const egg = await createFood(sqlite, { name: 'Huevo', caloriesKcal: 155 });
  const coffee = await createFood(sqlite, { name: 'Café', caloriesKcal: 1 });

  for (const date of ['2026-11-01', '2026-11-02', '2026-11-03']) {
    await addEntry(sqlite, { localDate: date, mealType: 'breakfast', food: coffee, grams: 200 });
  }
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'breakfast', food: egg, grams: 60 });
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'lunch', food: rice, grams: 150 });

  const breakfast = await getFrequentFoodsForMeal(sqlite, 'breakfast');
  assert.deepEqual(breakfast.map((f) => f.name), ['Café', 'Huevo']);
  assert.deepEqual((await getFrequentFoodsForMeal(sqlite, 'lunch')).map((f) => f.name), ['Arroz']);
  assert.deepEqual(await getFrequentFoodsForMeal(sqlite, 'dinner'), []);
  assert.equal((await getFrequentFoodsForMeal(sqlite, 'breakfast', 1)).length, 1);
});
