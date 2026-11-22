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

test('getWeekOverview summarises Monday to Sunday and leaves empty days out', async () => {
  const { getWeekOverview } = await import('../../src/data/sqlite/repositories/statsRepository');
  const { addEntry } = await import('../../src/data/sqlite/repositories/diaryRepository');
  const { createFood } = await import('../../src/data/sqlite/repositories/foodRepository');
  const { createMigratedDatabase } = await import('../helpers/sqliteAdapter');

  const sqlite = (await createMigratedDatabase()).asSqlite();
  const rice = await createFood(sqlite, { name: 'Arroz', caloriesKcal: 130 });
  const mystery = await createFood(sqlite, { name: 'Misterio' });

  // 2026-11-16 is a Monday; 2026-11-23 belongs to the next week.
  await addEntry(sqlite, { localDate: '2026-11-16', mealType: 'lunch', food: rice, grams: 200 });
  await addEntry(sqlite, { localDate: '2026-11-18', mealType: 'lunch', food: mystery, grams: 100 });
  await addEntry(sqlite, { localDate: '2026-11-22', mealType: 'dinner', food: rice, grams: 100 });
  await addEntry(sqlite, { localDate: '2026-11-23', mealType: 'dinner', food: rice, grams: 100 });

  const week = await getWeekOverview(sqlite, '2026-11-19');
  assert.deepEqual(Object.keys(week).sort(), ['2026-11-16', '2026-11-18', '2026-11-22']);
  assert.deepEqual(week['2026-11-16'], { caloriesKcal: 260, entries: 1 });
  assert.deepEqual(week['2026-11-18'], { caloriesKcal: null, entries: 1 });

  await assert.rejects(getWeekOverview(sqlite, 'mañana'), /fecha/);
});
