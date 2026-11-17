import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addEntry,
  deleteEntry,
  ensureMeal,
  getDiaryDay,
  moveEntry,
  updateEntryGrams,
} from '../../src/data/sqlite/repositories/diaryRepository';
import { createFood } from '../../src/data/sqlite/repositories/foodRepository';
import {
  addPlanEntry,
  copyPlanToDiary,
  getPlanDay,
} from '../../src/data/sqlite/repositories/planRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

const DATE = '2026-11-01';

async function setup() {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  const chicken = await createFood(sqlite, {
    name: 'Pollo',
    caloriesKcal: 150,
    proteinGrams: 25,
    carbohydrateGrams: 0,
    fatGrams: 5,
  });
  const mystery = await createFood(sqlite, { name: 'Misterio' });
  return { db, sqlite, chicken, mystery };
}

test('diary totals scale per-100 g values by the grams eaten', async () => {
  const { sqlite, chicken } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 200 });

  const day = await getDiaryDay(sqlite, DATE);
  assert.deepEqual(day.consumed, {
    caloriesKcal: 300,
    proteinGrams: 50,
    carbohydrateGrams: 0,
    fatGrams: 10,
  });
  assert.equal(day.goalsAreDefault, true);
});

test('an entry with unknown calories makes the total unknown, never zero', async () => {
  const { sqlite, chicken, mystery } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 100 });
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: mystery, grams: 100 });

  const day = await getDiaryDay(sqlite, DATE);
  assert.equal(day.consumed.caloriesKcal, null);
  assert.equal(day.meals.lunch.nutrients.caloriesKcal, null);
});

test('updating grams, moving and deleting entries keep totals consistent', async () => {
  const { sqlite, chicken } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 100 });
  const first = (await getDiaryDay(sqlite, DATE)).entries[0]!;

  await updateEntryGrams(sqlite, first.id, 300);
  await moveEntry(sqlite, first.id, DATE, 'dinner');
  let day = await getDiaryDay(sqlite, DATE);
  assert.equal(day.meals.dinner.entries.length, 1);
  assert.equal(day.consumed.caloriesKcal, 450);

  await deleteEntry(sqlite, first.id);
  day = await getDiaryDay(sqlite, DATE);
  assert.equal(day.entries.length, 0);
  assert.equal(day.consumed.caloriesKcal, 0);
});

test('invalid grams and invalid dates are rejected before touching the database', async () => {
  const { db, sqlite, chicken } = await setup();

  await assert.rejects(() =>
    addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 0 }),
  );
  await assert.rejects(() => ensureMeal(sqlite, 'garbage', 'lunch'), /fecha no es válida/);
  await assert.rejects(() =>
    addPlanEntry(sqlite, { localDate: 'garbage', mealType: 'lunch', food: chicken, grams: 100 }),
  );

  const meals = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM diary_meals');
  assert.equal(meals?.c, 0);
});

test('copying a plan day to the diary keeps snapshots and leaves the plan intact', async () => {
  const { sqlite, chicken, mystery } = await setup();
  await addPlanEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 100 });
  await addPlanEntry(sqlite, { localDate: DATE, mealType: 'dinner', food: mystery, grams: 50 });

  await copyPlanToDiary(sqlite, DATE);

  const diary = await getDiaryDay(sqlite, DATE);
  assert.equal(diary.entries.length, 2);
  assert.equal((await getPlanDay(sqlite, DATE)).entries.length, 2);
  assert.equal(diary.meals.lunch.nutrients.caloriesKcal, 150);
  assert.equal(diary.meals.dinner.nutrients.caloriesKcal, null);
});

test('diary exposes known totals and the number of foods without calories', async () => {
  const { sqlite, chicken, mystery } = await setup();
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 200 });
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: mystery, grams: 100 });

  const day = await getDiaryDay(sqlite, DATE);
  assert.deepEqual(day.consumedPartial.caloriesKcal, {
    knownTotal: 300,
    unknownCount: 1,
    complete: false,
  });
  assert.equal(day.meals.lunch.partial.caloriesKcal.unknownCount, 1);
  assert.equal(day.meals.dinner.partial.caloriesKcal.complete, true);
});

test('days before the first saved goal use the earliest real goal, not the default', async () => {
  const { db, sqlite } = await setup();
  await db.runAsync(
    `INSERT INTO nutrition_goals (effective_from, calories_kcal, protein_grams, carbohydrate_grams, fat_grams, created_at)
     VALUES ('2026-11-10', 2300, 120, 280, 70, '2026-11-10T08:00:00.000Z')`,
  );

  const before = await getDiaryDay(sqlite, '2026-11-01');
  assert.equal(before.goals.caloriesKcal, 2300);
  assert.equal(before.goalsAreDefault, false);

  const none = await createMigratedDatabase();
  const defaults = await getDiaryDay(none.asSqlite(), '2026-11-01');
  assert.equal(defaults.goalsAreDefault, true);
});

test('countDiaryEntries counts only the requested day', async () => {
  const { sqlite, chicken } = await setup();
  const { countDiaryEntries } = await import('../../src/data/sqlite/repositories/diaryRepository');
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 100 });
  await addEntry(sqlite, { localDate: DATE, mealType: 'dinner', food: chicken, grams: 100 });
  await addEntry(sqlite, { localDate: '2026-11-02', mealType: 'lunch', food: chicken, grams: 100 });

  assert.equal(await countDiaryEntries(sqlite, DATE), 2);
  assert.equal(await countDiaryEntries(sqlite, '2026-12-31'), 0);
});

test('copyDiaryDay repeats a day (or one meal) with snapshots and never changes the source', async () => {
  const { sqlite, chicken, mystery } = await setup();
  const { copyDiaryDay } = await import('../../src/data/sqlite/repositories/diaryRepository');
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 200 });
  await addEntry(sqlite, { localDate: DATE, mealType: 'dinner', food: mystery, grams: 100 });

  assert.equal(await copyDiaryDay(sqlite, DATE, '2026-11-02', 'lunch'), 1);
  assert.equal((await getDiaryDay(sqlite, '2026-11-02')).entries.length, 1);

  assert.equal(await copyDiaryDay(sqlite, DATE, '2026-11-03'), 2);
  const copied = await getDiaryDay(sqlite, '2026-11-03');
  assert.equal(copied.meals.lunch.nutrients.caloriesKcal, 300);
  assert.equal(copied.meals.dinner.nutrients.caloriesKcal, null);
  assert.equal((await getDiaryDay(sqlite, DATE)).entries.length, 2);

  assert.equal(await copyDiaryDay(sqlite, '2026-12-25', '2026-12-26'), 0);
  await assert.rejects(() => copyDiaryDay(sqlite, 'garbage', DATE), /fecha no es válida/);
});
