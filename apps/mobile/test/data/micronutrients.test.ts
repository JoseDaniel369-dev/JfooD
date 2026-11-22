import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeNutrients } from '@jfood/core';

import { LATEST_SCHEMA_VERSION, migrateDatabase } from '../../src/data/sqlite/migrate';
import { initialMigration } from '../../src/data/sqlite/migrations/001_initial';
import { planMigration } from '../../src/data/sqlite/migrations/002_plan';
import { settingsMigration } from '../../src/data/sqlite/migrations/003_settings';
import { waterMigration } from '../../src/data/sqlite/migrations/004_water';
import { goalMigration } from '../../src/data/sqlite/migrations/005_goal';
import { servingsMigration } from '../../src/data/sqlite/migrations/006_servings';
import {
  addEntry,
  copyDiaryDay,
  getDiaryDay,
} from '../../src/data/sqlite/repositories/diaryRepository';
import { updateEntryNutrients } from '../../src/data/sqlite/repositories/entryNutrientsRepository';
import {
  createFood,
  getFoodById,
  updateFood,
} from '../../src/data/sqlite/repositories/foodRepository';
import {
  addPlanEntry,
  copyPlanToDiary,
  getPlanDay,
} from '../../src/data/sqlite/repositories/planRepository';
import { exportBackup, parseBackup, restoreBackup } from '../../src/features/backup/backup';
import { TestDatabase, createMigratedDatabase } from '../helpers/sqliteAdapter';

const DATE = '2026-11-01';

const oats = {
  name: 'Copos de avena',
  caloriesKcal: 370,
  proteinGrams: 13,
  carbohydrateGrams: 60,
  fatGrams: 7,
  fiberGrams: 10,
  sugarsGrams: 1,
  saltGrams: 0.02,
};

test('a database from before the extras migrates keeping every row, with the new values unknown', async () => {
  const old = new TestDatabase();
  for (const sql of [
    initialMigration,
    planMigration,
    settingsMigration,
    waterMigration,
    goalMigration,
    servingsMigration,
  ]) {
    await old.execAsync(sql);
  }
  await old.execAsync('PRAGMA user_version = 6');
  await old.execAsync(
    `INSERT INTO foods (id, name, normalized_name, source, calories_kcal, protein_grams,
       carbohydrate_grams, fat_grams, is_favorite, created_at, updated_at)
     VALUES ('f1', 'Pan', 'pan', 'user', 250, 9, 49, 3, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`,
  );
  await old.execAsync(
    `INSERT INTO diary_meals (id, local_date, meal_type, created_at)
     VALUES ('m1', '${DATE}', 'lunch', '2026-11-01T10:00:00Z')`,
  );
  await old.execAsync(
    `INSERT INTO diary_entries (id, meal_id, food_id, food_name, grams, calories_kcal,
       protein_grams, carbohydrate_grams, fat_grams, created_at, updated_at)
     VALUES ('e1', 'm1', 'f1', 'Pan', 100, 250, 9, 49, 3, '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z')`,
  );

  await migrateDatabase(old.asSqlite());

  const version = await old.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  assert.equal(version?.user_version, LATEST_SCHEMA_VERSION);

  const food = await getFoodById(old.asSqlite(), 'f1');
  assert.equal(food?.caloriesKcal, 250);
  assert.equal(food?.fiberGrams, null);
  assert.equal(food?.isFavorite, true);

  const day = await getDiaryDay(old.asSqlite(), DATE);
  assert.equal(day.consumed.caloriesKcal, 250);
  assert.equal(day.consumed.fiberGrams, null, 'unknown stays unknown, not zero');
  assert.equal(day.consumedPartial.fiberGrams.unknownCount, 1);
});

test('the new columns refuse negative values at the database level', async () => {
  const db = await createMigratedDatabase();
  await assert.rejects(
    db.runAsync(
      `INSERT INTO foods (id, name, normalized_name, source, fiber_grams, created_at, updated_at)
       VALUES ('x', 'X', 'x', 'user', -1, 'now', 'now')`,
    ),
  );
});

test('a food keeps its fibre, sugars and salt and rejects impossible ones', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();

  const food = await createFood(sqlite, oats);
  const stored = await getFoodById(sqlite, food.id);
  assert.equal(stored?.fiberGrams, 10);
  assert.equal(stored?.sugarsGrams, 1);
  assert.equal(stored?.saltGrams, 0.02);

  await assert.rejects(
    createFood(sqlite, { name: 'Raro', carbohydrateGrams: 10, sugarsGrams: 40 }),
    /azúcares/,
  );
  await assert.rejects(createFood(sqlite, { name: 'Salado', saltGrams: 150 }), /100 g/);

  const updated = await updateFood(sqlite, food.id, { ...oats, saltGrams: 0.1 });
  assert.equal(updated?.saltGrams, 0.1);
});

test('diary and plan entries snapshot the extras and scale them by the grams eaten', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const food = await createFood(sqlite, oats);

  await addEntry(sqlite, { localDate: DATE, mealType: 'breakfast', food, grams: 50 });
  await addPlanEntry(sqlite, { localDate: DATE, mealType: 'lunch', food, grams: 200 });

  const diary = await getDiaryDay(sqlite, DATE);
  assert.equal(diary.consumed.fiberGrams, 5);
  assert.equal(diary.consumed.sugarsGrams, 0.5);
  assert.deepEqual(diary.targets, { fiberGrams: 28, sugarsGrams: 50, saltGrams: 5 });

  const plan = await getPlanDay(sqlite, DATE);
  assert.equal(plan.consumed.fiberGrams, 20);

  // Editing the food later never rewrites past entries.
  await updateFood(sqlite, food.id, { ...oats, fiberGrams: 99 });
  assert.equal((await getDiaryDay(sqlite, DATE)).consumed.fiberGrams, 5);
});

test('copying a day and moving the plan to the diary keep the extras', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const food = await createFood(sqlite, oats);

  await addEntry(sqlite, { localDate: DATE, mealType: 'breakfast', food, grams: 100 });
  assert.equal(await copyDiaryDay(sqlite, DATE, '2026-11-02'), 1);
  assert.equal((await getDiaryDay(sqlite, '2026-11-02')).consumed.fiberGrams, 10);

  await addPlanEntry(sqlite, { localDate: '2026-11-03', mealType: 'lunch', food, grams: 100 });
  await copyPlanToDiary(sqlite, '2026-11-03');
  assert.equal((await getDiaryDay(sqlite, '2026-11-03')).consumed.saltGrams, 0.02);
});

test('completing an entry can set the extras and also update the food', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const food = await createFood(sqlite, { name: 'Pan', caloriesKcal: 250 });
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food, grams: 100 });
  const entry = (await getDiaryDay(sqlite, DATE)).entries[0]!;

  await updateEntryNutrients(
    sqlite,
    'diary_entries',
    entry.id,
    makeNutrients({ caloriesKcal: 250, fiberGrams: 3, saltGrams: 1.2 }),
    { alsoUpdateFood: true },
  );

  assert.equal((await getDiaryDay(sqlite, DATE)).consumed.fiberGrams, 3);
  const updatedFood = await getFoodById(sqlite, food.id);
  assert.equal(updatedFood?.fiberGrams, 3);
  assert.equal(updatedFood?.saltGrams, 1.2);
});

test('backup round trip keeps the extras, and an older backup without them restores as unknown', async () => {
  const source = await createMigratedDatabase();
  const sqlite = source.asSqlite();
  const food = await createFood(sqlite, oats);
  await addEntry(sqlite, { localDate: DATE, mealType: 'breakfast', food, grams: 100 });

  const json = JSON.parse(JSON.stringify(await exportBackup(sqlite)));
  const target = await createMigratedDatabase();
  await restoreBackup(target.asSqlite(), parseBackup(json, LATEST_SCHEMA_VERSION));
  assert.equal((await getDiaryDay(target.asSqlite(), DATE)).consumed.fiberGrams, 10);

  // A file written before the extras existed has none of the columns.
  for (const table of ['foods', 'diary_entries', 'plan_entries']) {
    for (const row of json.tables[table] ?? []) {
      delete row.fiber_grams;
      delete row.sugars_grams;
      delete row.salt_grams;
    }
  }
  const older = await createMigratedDatabase();
  await restoreBackup(older.asSqlite(), parseBackup(json, LATEST_SCHEMA_VERSION));
  const day = await getDiaryDay(older.asSqlite(), DATE);
  assert.equal(day.consumed.caloriesKcal, 370);
  assert.equal(day.consumed.fiberGrams, null);
});
