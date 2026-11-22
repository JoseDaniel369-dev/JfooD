import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SAMPLE_FOODS } from '../../scripts/catalog/build-sample';
import type { CatalogInput } from '../../scripts/catalog/writeCatalog';
import {
  countCatalog,
  getCatalogByCategory,
  getCatalogCategories,
} from '../../src/data/sqlite/repositories/catalogRepository';
import { addEntry, getDiaryDay } from '../../src/data/sqlite/repositories/diaryRepository';
import {
  createFood,
  ensureFoodInLibrary,
  findFoodByBarcode,
  findFoodByExactName,
  getFavoriteFoods,
  getFoodById,
  getRecentFoods,
  searchFoods,
  toggleFavorite,
} from '../../src/data/sqlite/repositories/foodRepository';
import { getServings } from '../../src/data/sqlite/repositories/servingRepository';
import { isEditableSource } from '../../src/features/foods/types';
import { attachTestCatalog } from '../helpers/catalogFixture';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

const YOGURT_HACENDADO = 'off-8480000000011';
const YOGURT_DANONE = 'off-8410000000022';

async function databaseWithCatalog(extra: readonly CatalogInput[] = []) {
  const db = await createMigratedDatabase();
  await attachTestCatalog(db, [...SAMPLE_FOODS, ...extra]);
  return db;
}

// ---- Without a catalog --------------------------------------------------------

test('without a catalog attached the app behaves as before: only the persons own foods', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  await createFood(sqlite, { name: 'Yogur casero', caloriesKcal: 60 });

  assert.deepEqual((await searchFoods(sqlite, 'yogur')).map((f) => f.name), ['Yogur casero']);
  assert.equal(await findFoodByBarcode(sqlite, '8480000000011'), null);
  assert.equal(await getFoodById(sqlite, YOGURT_HACENDADO), null);
  assert.equal(await countCatalog(sqlite), 0);
  assert.deepEqual(await getCatalogCategories(sqlite), []);
});

// ---- Search ----------------------------------------------------------------------

test('a search finds catalog foods, with calories, ranked by popularity', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();

  const results = await searchFoods(sqlite, 'yogur');
  assert.deepEqual(results.map((f) => f.id), [YOGURT_HACENDADO, YOGURT_DANONE], 'most popular first');
  assert.equal(results[0]?.brand, 'Hacendado');
  assert.equal(results[0]?.caloriesKcal, 61);
  assert.equal(results[0]?.isFavorite, false);
});

test('the brand is searchable, in any order, ignoring accents', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();

  assert.deepEqual((await searchFoods(sqlite, 'danone yogur')).map((f) => f.id), [YOGURT_DANONE]);
  assert.deepEqual((await searchFoods(sqlite, 'galletas maria')).map((f) => f.brand), ['Marbú']);
  assert.equal((await searchFoods(sqlite, 'zzz-no-existe')).length, 0);
});

test('names that start with the word rank above names that only contain it', async () => {
  const sqlite = (
    await databaseWithCatalog([
      {
        id: 'off-1111111111111',
        name: 'Tarta de yogur',
        category: 'Dulces y snacks',
        source: 'open_food_facts',
        popularity: 100_000, // more popular, but the word is in the middle
        caloriesKcal: 300,
        proteinGrams: 5,
        carbohydrateGrams: 40,
        fatGrams: 12,
        fiberGrams: null,
        sugarsGrams: null,
        saltGrams: null,
      },
    ])
  ).asSqlite();

  const ids = (await searchFoods(sqlite, 'yogur')).map((f) => f.id);
  assert.deepEqual(ids, [YOGURT_HACENDADO, YOGURT_DANONE, 'off-1111111111111']);
});

test('the persons own foods and favourites come before the catalog', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const mine = await createFood(sqlite, { name: 'Yogur casero', caloriesKcal: 55 });

  assert.equal((await searchFoods(sqlite, 'yogur'))[0]?.id, mine.id, 'same rank: the library wins');

  const catalogYogurt = await getFoodById(sqlite, YOGURT_DANONE);
  assert.ok(catalogYogurt);
  const inLibrary = await ensureFoodInLibrary(sqlite, catalogYogurt);
  await toggleFavorite(sqlite, inLibrary.id);

  assert.equal((await searchFoods(sqlite, 'yogur'))[0]?.id, YOGURT_DANONE, 'a favourite is always first');
});

test('a catalog food already in the library is listed once, not twice', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const catalogYogurt = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(catalogYogurt);

  await ensureFoodInLibrary(sqlite, catalogYogurt);

  const ids = (await searchFoods(sqlite, 'yogur')).map((f) => f.id);
  assert.equal(ids.filter((id) => id === YOGURT_HACENDADO).length, 1);
  assert.equal(ids.length, 2);
});

test('a copied catalog food is still found by its brand, once, with the persons own favourite mark', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const fromCatalog = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(fromCatalog);
  const inLibrary = await ensureFoodInLibrary(sqlite, fromCatalog);
  await toggleFavorite(sqlite, inLibrary.id);

  // The library row has no brand in its searchable name: the catalog text is what finds it.
  const byBrand = await searchFoods(sqlite, 'hacendado');
  assert.deepEqual(byBrand.map((f) => f.id), [YOGURT_HACENDADO]);
  assert.equal(byBrand[0]?.isFavorite, true);

  const byName = await searchFoods(sqlite, 'yogur');
  assert.equal(byName.filter((f) => f.id === YOGURT_HACENDADO).length, 1);
  assert.equal(byName[0]?.id, YOGURT_HACENDADO, 'a favourite is first');
});

test('an edit the person made to a copied catalog food shows in the search, not the catalog original', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const fromCatalog = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(fromCatalog);
  await ensureFoodInLibrary(sqlite, fromCatalog);
  await sqlite.runAsync("UPDATE foods SET calories_kcal = 99 WHERE id = ?", [YOGURT_HACENDADO]);

  const found = (await searchFoods(sqlite, 'hacendado'))[0];
  assert.equal(found?.caloriesKcal, 99);
});

test('a copied catalog food the person renamed is found by the new name and by the brand', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const fromCatalog = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(fromCatalog);
  await ensureFoodInLibrary(sqlite, fromCatalog);
  await sqlite.runAsync("UPDATE foods SET name = 'Mi postre', normalized_name = 'mi postre' WHERE id = ?", [YOGURT_HACENDADO]);

  assert.deepEqual((await searchFoods(sqlite, 'postre')).map((f) => f.id), [YOGURT_HACENDADO]);
  assert.deepEqual((await searchFoods(sqlite, 'hacendado')).map((f) => f.id), [YOGURT_HACENDADO]);
});

test('two overlapping copies of the same or of different foods both succeed', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const a = await getFoodById(sqlite, YOGURT_HACENDADO);
  const b = await getFoodById(sqlite, YOGURT_DANONE);
  assert.ok(a && b);

  const results = await Promise.all([
    ensureFoodInLibrary(sqlite, a),
    ensureFoodInLibrary(sqlite, a),
    ensureFoodInLibrary(sqlite, b),
  ]);

  assert.deepEqual(results.map((f) => f.id), [YOGURT_HACENDADO, YOGURT_HACENDADO, YOGURT_DANONE]);
  assert.equal((await getServings(sqlite, YOGURT_HACENDADO)).length, 1);
});

test('an exact name finds the plain food even when branded products rank higher in a search', async () => {
  const sqlite = (await databaseWithCatalog([
    {
      id: 'usda-1',
      name: 'Arroz',
      category: 'Cereales, pan y pasta',
      source: 'seed',
      popularity: 50,
      caloriesKcal: 360, proteinGrams: 7, carbohydrateGrams: 79, fatGrams: 0.6,
      fiberGrams: null, sugarsGrams: null, saltGrams: null,
    },
    {
      id: 'off-9999999999999',
      name: 'Arroz largo',
      brand: 'Marca',
      barcode: '9999999999999',
      category: 'Cereales, pan y pasta',
      source: 'open_food_facts',
      popularity: 5000,
      caloriesKcal: 350, proteinGrams: 7, carbohydrateGrams: 77, fatGrams: 1,
      fiberGrams: null, sugarsGrams: null, saltGrams: null,
    },
  ])).asSqlite();

  assert.equal((await findFoodByExactName(sqlite, 'arroz'))?.id, 'usda-1');
  assert.equal(await findFoodByExactName(sqlite, 'arroz inexistente'), null);

  // A food the person has with that exact name wins over the catalog.
  const mine = await createFood(sqlite, { name: 'Arroz', caloriesKcal: 100 });
  assert.equal((await findFoodByExactName(sqlite, 'arroz'))?.id, mine.id);
});

test('the result limit applies to the combined list', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  assert.equal((await searchFoods(sqlite, 'yogur', 1)).length, 1);
});

// ---- Using a catalog food --------------------------------------------------------

test('a catalog food is copied to the library with its portions the first time it is used, once', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const fromCatalog = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(fromCatalog);

  const first = await ensureFoodInLibrary(sqlite, fromCatalog);
  const second = await ensureFoodInLibrary(sqlite, fromCatalog);

  assert.equal(first.id, YOGURT_HACENDADO);
  assert.equal(second.id, first.id);
  assert.equal(first.source, 'open_food_facts');
  assert.equal(isEditableSource(first.source), true);
  assert.equal(first.caloriesKcal, 61);
  assert.equal(first.brand, 'Hacendado');
  assert.deepEqual(
    (await getServings(sqlite, first.id)).map(({ label, grams }) => ({ label, grams })),
    [{ label: '1 yogur', grams: 125 }],
  );

  const count = await sqlite.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM foods WHERE id = ?',
    [first.id],
  );
  assert.equal(count[0]?.count, 1);
});

test('a copied catalog food works everywhere: diary, recents and favourites', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const fromCatalog = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(fromCatalog);

  const food = await ensureFoodInLibrary(sqlite, fromCatalog);
  await addEntry(sqlite, { localDate: '2026-11-18', mealType: 'breakfast', food, grams: 125 });
  await toggleFavorite(sqlite, food.id);

  const day = await getDiaryDay(sqlite, '2026-11-18');
  assert.equal(day.entries[0]?.foodName, 'Yogur natural');
  assert.equal(day.entries[0]?.per100g.caloriesKcal, 61, 'the entry keeps the foods calories');
  assert.deepEqual((await getRecentFoods(sqlite)).map((f) => f.id), [YOGURT_HACENDADO]);
  assert.deepEqual((await getFavoriteFoods(sqlite)).map((f) => f.id), [YOGURT_HACENDADO]);
});

test('using a catalog food does not touch foods the person already had', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const mine = await createFood(sqlite, { name: 'Pan casero', caloriesKcal: 250 });
  await toggleFavorite(sqlite, mine.id);

  const fromCatalog = await getFoodById(sqlite, YOGURT_DANONE);
  assert.ok(fromCatalog);
  await ensureFoodInLibrary(sqlite, fromCatalog);

  const kept = await getFoodById(sqlite, mine.id);
  assert.equal(kept?.isFavorite, true);
  assert.equal(kept?.caloriesKcal, 250);
});

// ---- Barcodes --------------------------------------------------------------------

test('a barcode is found in the catalog without a network, and the library wins once copied', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();

  const found = await findFoodByBarcode(sqlite, '8410000000033');
  assert.equal(found?.name, 'Pan de molde integral');
  assert.equal(found?.caloriesKcal, 245);

  await ensureFoodInLibrary(sqlite, found!);
  assert.equal((await findFoodByBarcode(sqlite, '8410000000033'))?.id, found?.id);
});

test('if the person already has a food with that barcode, that one is used instead of failing', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const theirs = await createFood(sqlite, {
    name: 'Mi yogur escaneado',
    barcode: '8480000000011',
    caloriesKcal: 70,
  });
  const fromCatalog = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(fromCatalog);

  const result = await ensureFoodInLibrary(sqlite, fromCatalog);

  assert.equal(result.id, theirs.id, 'the unique barcode index refused the copy; the existing food is returned');
  assert.equal(result.caloriesKcal, 70);
});

// ---- Browsing ----------------------------------------------------------------------

test('categories are listed with their size and browsed in pages, most popular first', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();

  const categories = await getCatalogCategories(sqlite);
  const dairy = categories.find((c) => c.name === 'Huevos y lácteos');
  assert.equal(dairy?.count, 3);
  assert.equal(await countCatalog(sqlite), SAMPLE_FOODS.length);

  const page1 = await getCatalogByCategory(sqlite, 'Huevos y lácteos', 2, 0);
  const page2 = await getCatalogByCategory(sqlite, 'Huevos y lácteos', 2, 2);
  assert.deepEqual(page1.map((f) => f.id), [YOGURT_HACENDADO, 'off-8410000000066']);
  assert.equal(page2.length, 1);
  assert.equal(new Set([...page1, ...page2].map((f) => f.id)).size, 3, 'pages do not overlap');
});

test('browsing shows the persons own favourite mark on a food they already copied', async () => {
  const sqlite = (await databaseWithCatalog()).asSqlite();
  const fromCatalog = await getFoodById(sqlite, YOGURT_HACENDADO);
  assert.ok(fromCatalog);
  const inLibrary = await ensureFoodInLibrary(sqlite, fromCatalog);
  await toggleFavorite(sqlite, inLibrary.id);

  const page = await getCatalogByCategory(sqlite, 'Huevos y lácteos', 10, 0);
  assert.equal(page.find((f) => f.id === YOGURT_HACENDADO)?.isFavorite, true);
  assert.equal(page.find((f) => f.id === YOGURT_DANONE)?.isFavorite, false);
});
