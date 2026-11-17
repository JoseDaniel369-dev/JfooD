import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addEntry, getDiaryDay } from '../../src/data/sqlite/repositories/diaryRepository';
import { updateEntryNutrients } from '../../src/data/sqlite/repositories/entryNutrientsRepository';
import { createFood, getFoodById } from '../../src/data/sqlite/repositories/foodRepository';
import { addPlanEntry, getPlanDay } from '../../src/data/sqlite/repositories/planRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

const DATE = '2026-11-01';
const completed = { caloriesKcal: 200, proteinGrams: 10, carbohydrateGrams: 20, fatGrams: 8 };

async function setup() {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  const mystery = await createFood(sqlite, { name: 'Misterio' });
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: mystery, grams: 150 });
  const entry = (await getDiaryDay(sqlite, DATE)).entries[0]!;
  return { db, sqlite, mystery, entry };
}

test('completing an entry turns an unknown total into a real one', async () => {
  const { sqlite, entry } = await setup();
  assert.equal((await getDiaryDay(sqlite, DATE)).consumed.caloriesKcal, null);

  await updateEntryNutrients(sqlite, 'diary_entries', entry.id, completed);

  const day = await getDiaryDay(sqlite, DATE);
  assert.equal(day.consumed.caloriesKcal, 300); // 200 kcal/100 g * 150 g
  assert.equal(day.consumedPartial.caloriesKcal.complete, true);
});

test('by default only that entry changes, the catalog food keeps its values', async () => {
  const { sqlite, mystery, entry } = await setup();
  await updateEntryNutrients(sqlite, 'diary_entries', entry.id, completed);

  assert.equal((await getFoodById(sqlite, mystery.id))?.caloriesKcal, null);
});

test('alsoUpdateFood stores the values in the user food too', async () => {
  const { sqlite, mystery, entry } = await setup();
  await updateEntryNutrients(sqlite, 'diary_entries', entry.id, completed, {
    alsoUpdateFood: true,
  });

  assert.equal((await getFoodById(sqlite, mystery.id))?.caloriesKcal, 200);
});

test('impossible values are rejected with a Spanish message and nothing is written', async () => {
  const { sqlite, entry } = await setup();

  await assert.rejects(
    () =>
      updateEntryNutrients(sqlite, 'diary_entries', entry.id, {
        ...completed,
        caloriesKcal: 5000,
      }),
    /950 kcal/,
  );
  assert.equal((await getDiaryDay(sqlite, DATE)).consumed.caloriesKcal, null);
});

test('plan entries can be completed the same way and unknown ids fail', async () => {
  const { sqlite, mystery } = await setup();
  await addPlanEntry(sqlite, { localDate: DATE, mealType: 'dinner', food: mystery, grams: 100 });
  const planEntry = (await getPlanDay(sqlite, DATE)).entries[0]!;

  await updateEntryNutrients(sqlite, 'plan_entries', planEntry.id, completed);
  assert.equal((await getPlanDay(sqlite, DATE)).consumed.caloriesKcal, 200);

  await assert.rejects(
    () => updateEntryNutrients(sqlite, 'plan_entries', 'nope', completed),
    /no encontrada/,
  );
});
