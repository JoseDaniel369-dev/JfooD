import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFood, deleteFood } from '../../src/data/sqlite/repositories/foodRepository';
import {
  deleteServing,
  getServings,
  saveServing,
} from '../../src/data/sqlite/repositories/servingRepository';
import { exportBackup, parseBackup, restoreBackup } from '../../src/features/backup/backup';
import { LATEST_SCHEMA_VERSION } from '../../src/data/sqlite/migrate';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

async function setup() {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  const egg = await createFood(sqlite, { name: 'Huevo', caloriesKcal: 143 });
  return { db, sqlite, egg };
}

test('servings are listed by size and saving the same name updates it', async () => {
  const { sqlite, egg } = await setup();
  await saveServing(sqlite, egg.id, '1 docena', 720);
  await saveServing(sqlite, egg.id, '1 unidad', 60);
  await saveServing(sqlite, egg.id, '  1   unidad ', 55);

  const servings = await getServings(sqlite, egg.id);
  assert.deepEqual(servings.map((s) => [s.label, s.grams]), [['1 unidad', 55], ['1 docena', 720]]);
});

test('invalid names and amounts are rejected in Spanish', async () => {
  const { sqlite, egg } = await setup();

  await assert.rejects(() => saveServing(sqlite, egg.id, '   ', 60), /nombre de la ración/);
  await assert.rejects(() => saveServing(sqlite, egg.id, 'x'.repeat(41), 60), /nombre de la ración/);
  await assert.rejects(() => saveServing(sqlite, egg.id, '1 unidad', 0), /mayores que 0/);
  await assert.rejects(() => saveServing(sqlite, egg.id, '1 unidad', -5), /mayores que 0/);
  assert.equal((await getServings(sqlite, egg.id)).length, 0);
});

test('servings can be deleted and disappear with their food', async () => {
  const { sqlite, egg } = await setup();
  await saveServing(sqlite, egg.id, '1 unidad', 60);
  await saveServing(sqlite, egg.id, '1 docena', 720);
  const [first] = await getServings(sqlite, egg.id);

  await deleteServing(sqlite, first!.id);
  assert.equal((await getServings(sqlite, egg.id)).length, 1);

  await deleteFood(sqlite, egg.id);
  assert.equal((await getServings(sqlite, egg.id)).length, 0);
});

test('servings survive a backup round trip', async () => {
  const { sqlite, egg } = await setup();
  await saveServing(sqlite, egg.id, '1 unidad', 60);
  const backup = JSON.parse(JSON.stringify(await exportBackup(sqlite)));

  const target = await createMigratedDatabase();
  const counts = await restoreBackup(target.asSqlite(), parseBackup(backup, LATEST_SCHEMA_VERSION));

  assert.equal(counts.food_servings, 1);
  assert.equal((await getServings(target.asSqlite(), egg.id))[0]?.grams, 60);
});
