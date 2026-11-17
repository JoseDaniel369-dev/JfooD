import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addEntry } from '../../src/data/sqlite/repositories/diaryRepository';
import { createFood } from '../../src/data/sqlite/repositories/foodRepository';
import { getDiaryStats } from '../../src/data/sqlite/repositories/statsRepository';
import { getDiaryDay } from '../../src/data/sqlite/repositories/diaryRepository';
import { toLocalDate } from '../../src/features/diary/utils/date';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

const today = toLocalDate(new Date());

test('week stats agree with the diary totals and flag days with unknown calories', async () => {
  const db = await createMigratedDatabase();
  const sqlite = db.asSqlite();
  const rice = await createFood(sqlite, { name: 'Arroz', caloriesKcal: 130 });
  const mystery = await createFood(sqlite, { name: 'Misterio' });

  await addEntry(sqlite, { localDate: today, mealType: 'lunch', food: rice, grams: 250 });
  await addEntry(sqlite, { localDate: today, mealType: 'dinner', food: mystery, grams: 100 });

  const stats = await getDiaryStats(sqlite);
  const todayStats = stats.week.at(-1)!;
  const diary = await getDiaryDay(sqlite, today);

  // SQL and the core engine compute the same known total (130 * 250 / 100).
  assert.equal(todayStats.caloriesKcal, 325);
  assert.equal(todayStats.caloriesKcal, diary.consumedPartial.caloriesKcal.knownTotal);
  assert.equal(todayStats.partial, true);
  assert.equal(todayStats.logged, true);
  assert.deepEqual(stats.loggedDates, [today]);

  const empty = stats.week[0]!;
  assert.deepEqual(
    { kcal: empty.caloriesKcal, partial: empty.partial, logged: empty.logged },
    { kcal: null, partial: false, logged: false },
  );
});
