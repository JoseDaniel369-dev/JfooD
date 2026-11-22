import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addEntry,
  getDiaryDay,
  moveEntry,
} from '../../src/data/sqlite/repositories/diaryRepository';
import { createFood } from '../../src/data/sqlite/repositories/foodRepository';
import {
  MAX_WATER_LOG_ML,
  addWater,
  getWaterDay,
} from '../../src/data/sqlite/repositories/waterRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

test('addWater rejects invalid dates and absurd amounts', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();

  await assert.rejects(addWater(sqlite, '2026-02-31', 250), /fecha/);
  await assert.rejects(addWater(sqlite, '2026-11-01', 0), /mayor que 0/);
  await assert.rejects(addWater(sqlite, '2026-11-01', MAX_WATER_LOG_ML + 1), /hasta/);

  await addWater(sqlite, '2026-11-01', MAX_WATER_LOG_ML);
  assert.equal((await getWaterDay(sqlite, '2026-11-01')).totalMl, MAX_WATER_LOG_ML);
});

test('diary reads and moves refuse dates that are not real calendar days', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const food = await createFood(sqlite, { name: 'Pan', caloriesKcal: 250 });
  await addEntry(sqlite, { localDate: '2026-11-01', mealType: 'lunch', food, grams: 100 });

  await assert.rejects(getDiaryDay(sqlite, 'ayer'), /fecha/);

  const day = await getDiaryDay(sqlite, '2026-11-01');
  const entryId = day.entries[0]!.id;
  await assert.rejects(moveEntry(sqlite, entryId, '2026-13-01', 'dinner'), /fecha/);
});
