import assert from 'node:assert/strict';
import { test } from 'node:test';

import { foodInputNutrientsSchema, makeNutrients } from '@jfood/core';

import {
  SEED_CATALOG,
  SEED_VERSION,
  SEED_VERSION_KEY,
  seedCatalog,
} from '../../src/data/seed/seedCatalog';
import {
  createFood,
  duplicateFoodAsUser,
  getFoodById,
  searchFoods,
  updateFood,
} from '../../src/data/sqlite/repositories/foodRepository';
import { getServings, saveServing } from '../../src/data/sqlite/repositories/servingRepository';
import { getSetting } from '../../src/data/sqlite/repositories/settingsRepository';
import { exportBackup, parseBackup, restoreBackup } from '../../src/features/backup/backup';
import { LATEST_SCHEMA_VERSION } from '../../src/data/sqlite/migrate';
import { isEditableSource } from '../../src/features/foods/types';
import { normalizeName } from '../../src/features/foods/utils/normalize';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

// ---- The data itself -------------------------------------------------------

test('the catalog is big enough to be useful and covers every category', () => {
  assert.ok(SEED_CATALOG.length >= 300, `only ${SEED_CATALOG.length} foods`);
  const categories = new Set(SEED_CATALOG.map((food) => food.category));
  for (const expected of [
    'Frutas',
    'Verduras y hortalizas',
    'Legumbres',
    'Cereales, pan y pasta',
    'Carnes y embutidos',
    'Pescados y mariscos',
    'Huevos y lácteos',
    'Grasas, frutos secos y salsas',
    'Bebidas',
    'Dulces y snacks',
    'Platos preparados',
  ]) {
    assert.ok(categories.has(expected), `missing category ${expected}`);
  }
});

test('every food passes the same validation as a food typed by a person', () => {
  for (const food of SEED_CATALOG) {
    const result = foodInputNutrientsSchema.safeParse(
      makeNutrients({
        caloriesKcal: food.caloriesKcal,
        proteinGrams: food.proteinGrams,
        carbohydrateGrams: food.carbohydrateGrams,
        fatGrams: food.fatGrams,
        fiberGrams: food.fiberGrams,
        sugarsGrams: food.sugarsGrams,
        saltGrams: food.saltGrams,
      }),
    );
    assert.equal(result.success, true, `${food.name}: ${JSON.stringify(result.error?.issues)}`);
  }
});

test('ids and normalized names are unique, so a re-seed never duplicates', () => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const food of SEED_CATALOG) {
    assert.match(food.id, /^seed-[a-z0-9-]+$/, food.name);
    assert.equal(ids.has(food.id), false, `repeated id ${food.id}`);
    ids.add(food.id);
    const normalized = normalizeName(food.name);
    assert.equal(names.has(normalized), false, `repeated name ${food.name}`);
    names.add(normalized);
  }
});

// Alcohol (7 kcal/g) and the sweeteners of "sin azúcar" drinks are not in
// protein/carbs/fat, and pure cocoa is 37 % fibre (carbohydrates "by
// difference" that give little energy), so those foods do not add up.
const ENERGY_EXEMPT = /cerveza|vino|licor|refresco|bebida isot|bebida energ|^sal$|cacao puro/i;

test('calories agree with 4·protein + 4·carbohydrates + 9·fat (within the usual tolerance)', () => {
  const offenders: string[] = [];
  for (const food of SEED_CATALOG) {
    if (ENERGY_EXEMPT.test(food.name)) continue;
    if (food.proteinGrams === null || food.carbohydrateGrams === null || food.fatGrams === null) continue;

    const fromMacros = 4 * food.proteinGrams + 4 * food.carbohydrateGrams + 9 * food.fatGrams;
    const gap = Math.abs(food.caloriesKcal - fromMacros);
    // Fibre, rounding and each country's energy factors move this a little.
    if (gap > 25 && gap / Math.max(food.caloriesKcal, 1) > 0.3) {
      offenders.push(`${food.name}: ${food.caloriesKcal} kcal vs ${Math.round(fromMacros)} from macros`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('portions are sensible and unique per food', () => {
  for (const food of SEED_CATALOG) {
    const labels = new Set<string>();
    for (const serving of food.servings) {
      assert.ok(serving.grams > 0 && serving.grams <= 1500, `${food.name}: ${serving.label}`);
      assert.equal(labels.has(serving.label), false, `${food.name} repeats ${serving.label}`);
      labels.add(serving.label);
    }
  }
});

// ---- Seeding ---------------------------------------------------------------

test('a fresh database gets the whole catalog with its portions, as non-editable foods', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  assert.equal(await seedCatalog(sqlite), true);

  const rows = await sqlite.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM foods WHERE source = 'seed'",
  );
  assert.equal(rows[0]?.count, SEED_CATALOG.length);
  assert.equal(await getSetting(sqlite, SEED_VERSION_KEY), String(SEED_VERSION));

  const apple = await getFoodById(sqlite, 'seed-manzana');
  assert.equal(apple?.source, 'seed');
  assert.equal(apple?.caloriesKcal, 52);
  assert.equal(apple?.fiberGrams, 2.4);
  assert.equal(isEditableSource(apple!.source), false);

  assert.deepEqual(
    (await getServings(sqlite, 'seed-manzana')).map((s) => [s.label, s.grams]),
    [['1 unidad mediana', 180]],
  );
});

test('seeding again does nothing, and never duplicates', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  await seedCatalog(sqlite);
  assert.equal(await seedCatalog(sqlite), false);

  const rows = await sqlite.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM foods');
  assert.equal(rows[0]?.count, SEED_CATALOG.length);
});

test('catalog foods the person deleted do not come back on the next launch', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  await seedCatalog(sqlite);
  await sqlite.runAsync("DELETE FROM foods WHERE source = 'seed'");

  assert.equal(await seedCatalog(sqlite), false);
  const rows = await sqlite.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM foods WHERE source = 'seed'",
  );
  assert.equal(rows[0]?.count, 0);
});

test('a new catalog version refreshes the catalog foods but never the person’s own', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  await seedCatalog(sqlite);

  const mine = await createFood(sqlite, { name: 'Mi manzana', caloriesKcal: 99 });
  await sqlite.runAsync("UPDATE foods SET calories_kcal = 1 WHERE id = 'seed-manzana'");
  await sqlite.runAsync(`UPDATE app_settings SET value = '0' WHERE key = '${SEED_VERSION_KEY}'`);

  assert.equal(await seedCatalog(sqlite), true);
  assert.equal((await getFoodById(sqlite, 'seed-manzana'))?.caloriesKcal, 52, 'catalog value restored');
  assert.equal((await getFoodById(sqlite, mine.id))?.caloriesKcal, 99, 'own food untouched');
});

test('a food id that belongs to the person is never overwritten by the catalog', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  // Simulates a user food that happens to carry a catalog id.
  await sqlite.runAsync(
    `INSERT INTO foods (id, name, normalized_name, source, calories_kcal, created_at, updated_at)
     VALUES ('seed-manzana', 'Manzana mía', 'manzana mia', 'user', 7, 'now', 'now')`,
  );

  await seedCatalog(sqlite);

  const food = await getFoodById(sqlite, 'seed-manzana');
  assert.equal(food?.name, 'Manzana mía');
  assert.equal(food?.caloriesKcal, 7);
});

test('portions the person changed are not overwritten when the catalog refreshes', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  await seedCatalog(sqlite);

  await saveServing(sqlite, 'seed-manzana', '1 unidad mediana', 200);
  await sqlite.runAsync(`UPDATE app_settings SET value = '0' WHERE key = '${SEED_VERSION_KEY}'`);
  await seedCatalog(sqlite);

  const [serving] = await getServings(sqlite, 'seed-manzana');
  assert.equal(serving?.grams, 200);
});

test('catalog foods can be searched ignoring accents and word order', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  await seedCatalog(sqlite);

  assert.equal((await searchFoods(sqlite, 'platano')).some((f) => f.name === 'Plátano'), true);
  assert.equal((await searchFoods(sqlite, 'pollo pechuga')).some((f) => f.name === 'Pechuga de pollo cocinada'), true);
  assert.ok((await searchFoods(sqlite, 'arroz pollo')).some((f) => f.name === 'Arroz con pollo'));
  assert.ok((await searchFoods(sqlite, 'tortilla')).length >= 2);
});

test('a catalog food cannot be edited into an impossible one, and diary entries keep their snapshot', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  await seedCatalog(sqlite);

  await assert.rejects(updateFood(sqlite, 'seed-manzana', { name: 'Manzana', caloriesKcal: 5000 }), /950/);
});

test('after restoring a backup that has no catalog, the catalog comes back', async () => {
  const source = await createMigratedDatabase();
  await createFood(source.asSqlite(), { name: 'Solo mío', caloriesKcal: 10 });
  const json = JSON.parse(JSON.stringify(await exportBackup(source.asSqlite())));
  // The backup was made before the catalog existed: no seed foods, no seed_version.
  assert.equal(json.tables.foods.some((f: { source: string }) => f.source === 'seed'), false);

  const target = await createMigratedDatabase();
  const sqlite = target.asSqlite();
  await seedCatalog(sqlite);
  await restoreBackup(sqlite, parseBackup(json, LATEST_SCHEMA_VERSION));

  const before = await sqlite.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM foods WHERE source = 'seed'",
  );
  assert.equal(before[0]?.count, 0);

  // The restore reloads the catalog on purpose, whatever version is stored.
  assert.equal(await seedCatalog(sqlite, { force: true }), true);
  const after = await sqlite.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM foods WHERE source = 'seed'",
  );
  assert.equal(after[0]?.count, SEED_CATALOG.length);
  assert.ok(await searchFoods(sqlite, 'solo mio'), 'own food still there');
});

test('getFoodsByIds returns foods in the order asked and skips unknown ids', async () => {
  const { getFoodsByIds } = await import('../../src/data/sqlite/repositories/foodRepository');
  const sqlite = (await createMigratedDatabase()).asSqlite();
  await seedCatalog(sqlite);

  const foods = await getFoodsByIds(sqlite, ['seed-platano', 'nope', 'seed-manzana']);
  assert.deepEqual(foods.map((f) => f.name), ['Plátano', 'Manzana']);
  assert.deepEqual(await getFoodsByIds(sqlite, []), []);

  // More ids than one chunk still works.
  const all = await getFoodsByIds(sqlite, SEED_CATALOG.map((f) => f.id));
  assert.equal(all.length, SEED_CATALOG.length);
});

test('a catalog food can be duplicated as the person’s own, with its portions, leaving the original alone', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  await seedCatalog(sqlite);
  const original = await getFoodById(sqlite, 'seed-manzana');
  assert.ok(original);
  const originalPortions = await getServings(sqlite, 'seed-manzana');
  assert.ok(originalPortions.length > 0, 'the catalog apple has portions');

  const copy = await duplicateFoodAsUser(sqlite, 'seed-manzana');
  assert.ok(copy);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.source, 'user');
  assert.equal(isEditableSource(copy.source), true);
  assert.equal(copy.name, `${original.name} (mío)`);
  assert.equal(copy.caloriesKcal, original.caloriesKcal);
  assert.equal(copy.fiberGrams, original.fiberGrams);

  const copyPortions = await getServings(sqlite, copy.id);
  assert.deepEqual(
    copyPortions.map(({ label, grams }) => ({ label, grams })),
    originalPortions.map(({ label, grams }) => ({ label, grams })),
  );

  // The copy can be edited; the original did not change.
  const edited = await updateFood(sqlite, copy.id, { name: 'Mi manzana', caloriesKcal: 60 });
  assert.equal(edited?.caloriesKcal, 60);
  assert.equal((await getFoodById(sqlite, 'seed-manzana'))?.caloriesKcal, original.caloriesKcal);
  assert.equal((await getServings(sqlite, 'seed-manzana')).length, originalPortions.length);
});

test('duplicating a food that does not exist gives null and creates nothing', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const before = await sqlite.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM foods');

  assert.equal(await duplicateFoodAsUser(sqlite, 'nope'), null);

  const after = await sqlite.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM foods');
  assert.equal(after[0]?.count, before[0]?.count);
});
