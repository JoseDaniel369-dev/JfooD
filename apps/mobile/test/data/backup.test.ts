import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addEntry, getDiaryDay } from '../../src/data/sqlite/repositories/diaryRepository';
import { createFood } from '../../src/data/sqlite/repositories/foodRepository';
import { addPlanEntry } from '../../src/data/sqlite/repositories/planRepository';
import { saveProfile } from '../../src/data/sqlite/repositories/profileRepository';
import { setSetting } from '../../src/data/sqlite/repositories/settingsRepository';
import { addWater } from '../../src/data/sqlite/repositories/waterRepository';
import {
  BackupError,
  exportBackup,
  parseBackup,
  restoreBackup,
} from '../../src/features/backup/backup';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

const DATE = '2026-11-01';

async function populated() {
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
  await addEntry(sqlite, { localDate: DATE, mealType: 'lunch', food: chicken, grams: 200 });
  await addEntry(sqlite, { localDate: DATE, mealType: 'dinner', food: mystery, grams: 100 });
  await addPlanEntry(sqlite, { localDate: '2026-11-02', mealType: 'lunch', food: chicken, grams: 100 });
  await addWater(sqlite, DATE, 500);
  await setSetting(sqlite, 'theme', 'dark');
  await saveProfile(sqlite, {
    weightKg: 70,
    heightCm: 175,
    birthDate: '1990-06-15',
    variant: 'male',
    activityLevel: 'moderate',
  });
  return { db, sqlite };
}

test('export → JSON → restore reproduces every table and the same totals', async () => {
  const source = await populated();
  const backup = await exportBackup(source.sqlite);
  const json = JSON.parse(JSON.stringify(backup));

  const target = await createMigratedDatabase();
  const parsed = parseBackup(json, 4);
  const counts = await restoreBackup(target.asSqlite(), parsed);

  assert.equal(counts.foods, 2);
  assert.equal(counts.diary_entries, 2);
  assert.equal(counts.plan_entries, 1);

  const original = await getDiaryDay(source.sqlite, DATE);
  const restored = await getDiaryDay(target.asSqlite(), DATE);
  assert.deepEqual(restored.consumedPartial, original.consumedPartial);
  assert.deepEqual(restored.goals, original.goals);

  const again = await exportBackup(target.asSqlite(), new Date(backup.createdAt));
  assert.deepEqual(again.tables, backup.tables);
});

test('restoring replaces existing data instead of merging', async () => {
  const source = await populated();
  const backup = parseBackup(JSON.parse(JSON.stringify(await exportBackup(source.sqlite))), 4);

  const target = await createMigratedDatabase();
  await createFood(target.asSqlite(), { name: 'Alimento que debe desaparecer' });
  await restoreBackup(target.asSqlite(), backup);

  const names = await target.getAllAsync<{ name: string }>('SELECT name FROM foods ORDER BY name');
  assert.deepEqual(names.map((n) => n.name), ['Misterio', 'Pollo']);
});

test('an invalid row rolls everything back and keeps the current data', async () => {
  const source = await populated();
  const good = JSON.parse(JSON.stringify(await exportBackup(source.sqlite)));
  good.tables.diary_entries[0].grams = -5; // violates CHECK (grams > 0)

  const targetDb = await populated();
  const target = targetDb.sqlite;
  const before = await exportBackup(target, new Date(0));

  await assert.rejects(
    () => restoreBackup(target, parseBackup(good, 4)),
    (error: unknown) => error instanceof BackupError && /No se ha cambiado nada/.test(error.message),
  );

  const after = await exportBackup(target, new Date(0));
  assert.deepEqual(after.tables, before.tables);
});

test('a broken reference (entry pointing to a missing meal) is rejected atomically', async () => {
  const source = await populated();
  const bad = JSON.parse(JSON.stringify(await exportBackup(source.sqlite)));
  bad.tables.diary_meals = [];

  const target = (await populated()).sqlite;
  await assert.rejects(() => restoreBackup(target, parseBackup(bad, 4)), BackupError);
  assert.equal((await getDiaryDay(target, DATE)).entries.length, 2);
});

test('parseBackup rejects foreign, newer, malformed or hostile files', () => {
  const base = { format: 'jfood-backup', version: 1, schemaVersion: 4, createdAt: '', tables: {} };

  assert.doesNotThrow(() => parseBackup(base, 4));
  assert.throws(() => parseBackup(null, 4), /no es una copia/);
  assert.throws(() => parseBackup({ ...base, format: 'other' }, 4), /no es una copia/);
  assert.throws(() => parseBackup({ ...base, version: 2 }, 4), /versión más nueva/);
  assert.throws(() => parseBackup({ ...base, schemaVersion: 5 }, 4), /más nueva/);
  assert.throws(() => parseBackup({ ...base, tables: [] }, 4), /no contiene datos/);
  assert.throws(() => parseBackup({ ...base, tables: { users: [] } }, 4), /tabla desconocida/);
  assert.throws(
    () => parseBackup({ ...base, tables: { foods: [{ 'id); DROP TABLE foods; --': 'x' }] } }, 4),
    /Columna desconocida/,
  );
  assert.throws(() => parseBackup({ ...base, tables: { foods: [{ id: {} }] } }, 4), /Valor no válido/);
  assert.throws(() => parseBackup({ ...base, tables: { foods: [{ id: Infinity }] } }, 4), /Número no válido/);
  assert.throws(() => parseBackup({ ...base, tables: { foods: 'x' } }, 4), /Datos no válidos/);
});

test('backups from an older schema without newer tables restore as empty tables', async () => {
  const source = await populated();
  const json = JSON.parse(JSON.stringify(await exportBackup(source.sqlite)));
  json.schemaVersion = 3;
  delete json.tables.water_logs;

  const target = await createMigratedDatabase();
  const counts = await restoreBackup(target.asSqlite(), parseBackup(json, 4));
  assert.equal(counts.water_logs, 0);
  assert.equal(counts.foods, 2);
});
