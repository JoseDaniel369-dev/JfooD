import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFood } from '../../src/data/sqlite/repositories/foodRepository';
import {
  addPlanEntry,
  copyPlanDay,
  getPlanDay,
  getPlanWeek,
} from '../../src/data/sqlite/repositories/planRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

async function setup() {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  const rice = await createFood(sqlite, { name: 'Arroz', caloriesKcal: 130 });
  const mystery = await createFood(sqlite, { name: 'Misterio' });
  return { sqlite, rice, mystery };
}

test('getPlanWeek summarises 7 days with known, partial and empty states', async () => {
  const { sqlite, rice, mystery } = await setup();
  await addPlanEntry(sqlite, { localDate: '2026-11-16', mealType: 'lunch', food: rice, grams: 200 });
  await addPlanEntry(sqlite, { localDate: '2026-11-17', mealType: 'lunch', food: rice, grams: 100 });
  await addPlanEntry(sqlite, { localDate: '2026-11-17', mealType: 'dinner', food: mystery, grams: 50 });
  await addPlanEntry(sqlite, { localDate: '2026-11-30', mealType: 'lunch', food: rice, grams: 100 }); // other week

  const week = await getPlanWeek(sqlite, '2026-11-16');

  assert.equal(week.length, 7);
  assert.deepEqual(week.map((d) => d.localDate)[6], '2026-11-22');
  assert.deepEqual(week[0], { localDate: '2026-11-16', entryCount: 1, caloriesKcal: 260, partial: false });
  assert.deepEqual(week[1], { localDate: '2026-11-17', entryCount: 2, caloriesKcal: 130, partial: true });
  assert.deepEqual(week[2], { localDate: '2026-11-18', entryCount: 0, caloriesKcal: null, partial: false });
  assert.equal(week.reduce((sum, d) => sum + d.entryCount, 0), 3);
});

test('copyPlanDay duplicates entries with snapshots and leaves the source untouched', async () => {
  const { sqlite, rice, mystery } = await setup();
  await addPlanEntry(sqlite, { localDate: '2026-11-16', mealType: 'lunch', food: rice, grams: 200 });
  await addPlanEntry(sqlite, { localDate: '2026-11-16', mealType: 'dinner', food: mystery, grams: 50 });

  assert.equal(await copyPlanDay(sqlite, '2026-11-16', '2026-11-17'), 2);

  const copy = await getPlanDay(sqlite, '2026-11-17');
  assert.equal(copy.entries.length, 2);
  assert.equal(copy.meals.lunch.nutrients.caloriesKcal, 260);
  assert.equal(copy.meals.dinner.nutrients.caloriesKcal, null);
  assert.equal((await getPlanDay(sqlite, '2026-11-16')).entries.length, 2);
  assert.equal(await copyPlanDay(sqlite, '2026-12-01', '2026-12-02'), 0);
  await assert.rejects(() => copyPlanDay(sqlite, 'garbage', '2026-11-17'), /fecha no es válida/);
});
