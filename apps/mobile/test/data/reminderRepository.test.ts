import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addEntry } from '../../src/data/sqlite/repositories/diaryRepository';
import { createFood } from '../../src/data/sqlite/repositories/foodRepository';
import { getReminderContext } from '../../src/data/sqlite/repositories/reminderRepository';
import { upsertWeightLog } from '../../src/data/sqlite/repositories/weightRepository';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

test('the reminder context lists the meals logged and whether the person weighed in', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const food = await createFood(sqlite, { name: 'Pan', caloriesKcal: 250 });

  assert.deepEqual(await getReminderContext(sqlite, '2026-11-18'), {
    loggedMealsToday: [],
    weighedToday: false,
  });

  await addEntry(sqlite, { localDate: '2026-11-18', mealType: 'breakfast', food, grams: 50 });
  await addEntry(sqlite, { localDate: '2026-11-18', mealType: 'breakfast', food, grams: 30 });
  await addEntry(sqlite, { localDate: '2026-11-17', mealType: 'dinner', food, grams: 50 });
  await upsertWeightLog(sqlite, { localDate: '2026-11-18', weightKg: 70 });

  const context = await getReminderContext(sqlite, '2026-11-18');
  assert.deepEqual(context.loggedMealsToday, ['breakfast'], 'one per meal, only that day');
  assert.equal(context.weighedToday, true);
  assert.equal((await getReminderContext(sqlite, '2026-11-17')).weighedToday, false);

  await assert.rejects(getReminderContext(sqlite, '2026-02-31'), /fecha/);
});
