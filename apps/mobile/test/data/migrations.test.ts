import assert from 'node:assert/strict';
import { test } from 'node:test';

import { migrateDatabase } from '../../src/data/sqlite/migrate';
import { createMigratedDatabase, TestDatabase } from '../helpers/sqliteAdapter';

const EXPECTED_TABLES = [
  'app_settings',
  'diary_entries',
  'diary_meals',
  'foods',
  'nutrition_goals',
  'plan_entries',
  'user_profile',
  'water_logs',
  'weight_logs',
];

async function tableNames(db: TestDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

test('migrations create every table from an empty database', async () => {
  const db = await createMigratedDatabase();
  assert.deepEqual(await tableNames(db), EXPECTED_TABLES);
  const version = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  assert.equal(version?.user_version, 5);
});

test('running migrations twice is idempotent and keeps user data', async () => {
  const db = await createMigratedDatabase();
  await db.runAsync(
    `INSERT INTO weight_logs (id, local_date, weight_kg, note, created_at)
     VALUES ('w1', '2026-11-01', 70, NULL, '2026-11-01T10:00:00.000Z')`,
  );

  await migrateDatabase(db.asSqlite());

  const rows = await db.getAllAsync<{ weight_kg: number }>(
    'SELECT weight_kg FROM weight_logs',
  );
  assert.deepEqual(rows, [{ weight_kg: 70 }]);
});

test('deleting a food keeps the diary entry snapshot (SET NULL)', async () => {
  const db = await createMigratedDatabase();
  const now = '2026-11-01T10:00:00.000Z';
  await db.execAsync(`
    INSERT INTO foods (id, name, normalized_name, source, created_at, updated_at)
      VALUES ('f1', 'Arroz', 'arroz', 'user', '${now}', '${now}');
    INSERT INTO diary_meals (id, local_date, meal_type, created_at)
      VALUES ('m1', '2026-11-01', 'lunch', '${now}');
    INSERT INTO diary_entries (id, meal_id, food_id, food_name, grams, calories_kcal, created_at, updated_at)
      VALUES ('e1', 'm1', 'f1', 'Arroz', 100, 130, '${now}', '${now}');
    DELETE FROM foods WHERE id = 'f1';
  `);

  const entry = await db.getFirstAsync<{
    food_id: string | null;
    food_name: string;
    calories_kcal: number;
  }>('SELECT food_id, food_name, calories_kcal FROM diary_entries');
  assert.deepEqual(entry, { food_id: null, food_name: 'Arroz', calories_kcal: 130 });
});

test('a database from a newer app version is never opened by an older build', async () => {
  const db = new TestDatabase();
  await db.execAsync('PRAGMA user_version = 99');

  await assert.rejects(() => migrateDatabase(db.asSqlite()), /más nueva/);
  const tables = await tableNames(db);
  assert.deepEqual(tables, []);
});
