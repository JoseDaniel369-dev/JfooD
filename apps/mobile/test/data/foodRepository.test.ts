import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createFood,
  getRecentFoods,
  searchFoods,
} from '../../src/data/sqlite/repositories/foodRepository';
import { addEntry } from '../../src/data/sqlite/repositories/diaryRepository';
import { addPlanEntry } from '../../src/data/sqlite/repositories/planRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

async function setup() {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  const rice = await createFood(sqlite, { name: 'Arroz', caloriesKcal: 130 });
  const chicken = await createFood(sqlite, { name: 'Pollo', caloriesKcal: 165 });
  const apple = await createFood(sqlite, { name: 'Manzana', caloriesKcal: 52 });
  const unused = await createFood(sqlite, { name: 'Nunca usado' });
  return { db, sqlite, rice, chicken, apple, unused };
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

test('getRecentFoods returns one row per used food, newest first', async () => {
  const { sqlite, rice, chicken, apple } = await setup();

  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'lunch', food: rice, grams: 100 });
  await pause();
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'lunch', food: chicken, grams: 100 });
  await pause();
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'snack', food: apple, grams: 100 });
  await pause();
  await addPlanEntry(sqlite, { localDate: '2026-11-02', mealType: 'dinner', food: rice, grams: 50 });

  const recents = await getRecentFoods(sqlite, 10);

  assert.deepEqual(
    recents.map((food) => food.name),
    ['Arroz', 'Manzana', 'Pollo'],
  );
});

test('getRecentFoods honours the limit and ignores unused foods', async () => {
  const { sqlite, rice, chicken } = await setup();

  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'lunch', food: rice, grams: 100 });
  await pause();
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'lunch', food: chicken, grams: 100 });

  assert.deepEqual((await getRecentFoods(sqlite, 1)).map((f) => f.name), ['Pollo']);
  assert.equal((await getRecentFoods(sqlite, 10)).some((f) => f.name === 'Nunca usado'), false);
});

test('getRecentFoods is empty when nothing was logged', async () => {
  const { sqlite } = await setup();
  assert.deepEqual(await getRecentFoods(sqlite, 10), []);
});

test('searchFoods ignores accents and escapes LIKE wildcards', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  await createFood(sqlite, { name: 'Jamón serrano' });
  await createFood(sqlite, { name: '100% cacao' });

  assert.equal((await searchFoods(sqlite, 'jamon')).length, 1);
  assert.deepEqual((await searchFoods(sqlite, '%')).map((f) => f.name), ['100% cacao']);
});

test('createFood and updateFood refuse physically impossible typed values', async () => {
  const { updateFood } = await import('../../src/data/sqlite/repositories/foodRepository');
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();

  await assert.rejects(() => createFood(sqlite, { name: 'Imposible', caloriesKcal: 5000 }), /950 kcal/);
  await assert.rejects(
    () => createFood(sqlite, { name: 'Imposible 2', proteinGrams: 80, carbohydrateGrams: 80 }),
    /100 g por cada 100 g/,
  );

  const ok = await createFood(sqlite, { name: 'Aceite', caloriesKcal: 884, fatGrams: 100 });
  await assert.rejects(() => updateFood(sqlite, ok.id, { name: 'Aceite', caloriesKcal: 9999 }), /950 kcal/);
  assert.equal((await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM foods'))?.c, 1);
});

test('searchFoods matches every word in any order and ranks prefixes first', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  await createFood(sqlite, { name: 'Pollo con arroz' });
  await createFood(sqlite, { name: 'Arroz blanco' });
  await createFood(sqlite, { name: 'Arroz con pollo asado' });
  await createFood(sqlite, { name: 'Pollo asado' });

  const both = (await searchFoods(sqlite, 'arroz pollo')).map((f) => f.name).sort();
  assert.deepEqual(both, ['Arroz con pollo asado', 'Pollo con arroz']);

  const ranked = (await searchFoods(sqlite, 'arroz')).map((f) => f.name);
  assert.ok(ranked.slice(0, 2).every((name) => name.toLowerCase().startsWith('arroz')));

  assert.equal((await searchFoods(sqlite, '  ')).length, 4);
  assert.equal((await searchFoods(sqlite, 'zanahoria')).length, 0);
});

test('getFrequentFoods orders by how often a food was logged', async () => {
  const { getFrequentFoods } = await import('../../src/data/sqlite/repositories/foodRepository');
  const { sqlite, rice, chicken, apple } = await setup();

  for (let i = 0; i < 3; i += 1) {
    await addEntry(sqlite, { localDate: `2026-11-0${i + 1}`, mealType: 'lunch', food: chicken, grams: 100 });
  }
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'lunch', food: rice, grams: 100 });
  await pause();
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'snack', food: apple, grams: 100 });

  assert.deepEqual((await getFrequentFoods(sqlite, 10)).map((f) => f.name), ['Pollo', 'Manzana', 'Arroz']);
  assert.equal((await getFrequentFoods(sqlite, 1)).length, 1);
});
