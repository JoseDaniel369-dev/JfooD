import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, assertLocalDate, startOfWeek, toLocalDate } from '@/features/diary/utils/date';
import type { WeekStripDayData } from '@/features/diary/utils/weekStrip';
import type { DayCalories } from '@/features/stats/utils/streak';

export interface DiaryStats {
  loggedDates: string[];
  week: DayCalories[];
}

interface WeekRow {
  local_date: string;
  /** Sum of the known calories; NULL when no entry of the day has calories. */
  kcal: number | null;
  entries: number;
  known: number;
}

export async function getDiaryStats(
  database: SQLiteDatabase,
): Promise<DiaryStats> {
  const today = toLocalDate(new Date());
  const cutoff = addDays(today, -6);

  const [dateRows, weekRows] = await Promise.all([
    database.getAllAsync<{ local_date: string }>(
      `SELECT DISTINCT meal.local_date
       FROM diary_meals AS meal
       INNER JOIN diary_entries AS entry ON entry.meal_id = meal.id
       ORDER BY meal.local_date`,
    ),
    database.getAllAsync<WeekRow>(
      `SELECT meal.local_date,
              SUM(entry.calories_kcal * entry.grams / 100.0) AS kcal,
              COUNT(*) AS entries,
              COUNT(entry.calories_kcal) AS known
       FROM diary_entries AS entry
       INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
       WHERE meal.local_date >= ?
       GROUP BY meal.local_date`,
      cutoff,
    ),
  ]);

  const weekMap = new Map(weekRows.map((row) => [row.local_date, row]));

  const week: DayCalories[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const localDate = addDays(today, offset);
    const row = weekMap.get(localDate);
    week.push({
      localDate,
      caloriesKcal: row?.kcal ?? null,
      partial: row ? row.known < row.entries : false,
      logged: row ? row.entries > 0 : false,
    });
  }

  return {
    loggedDates: dateRows.map((row) => row.local_date),
    week,
  };
}

/**
 * What was logged on each day of the week (Monday to Sunday) that contains
 * `anyDateInWeek`, keyed by date. Days without entries are absent.
 */
export async function getWeekOverview(
  database: SQLiteDatabase,
  anyDateInWeek: string,
): Promise<Record<string, WeekStripDayData>> {
  assertLocalDate(anyDateInWeek);
  const monday = startOfWeek(anyDateInWeek);
  const sunday = addDays(monday, 6);

  const rows = await database.getAllAsync<{
    local_date: string;
    kcal: number | null;
    entries: number;
  }>(
    `SELECT meal.local_date,
            SUM(entry.calories_kcal * entry.grams / 100.0) AS kcal,
            COUNT(*) AS entries
     FROM diary_entries AS entry
     INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
     WHERE meal.local_date >= ? AND meal.local_date <= ?
     GROUP BY meal.local_date`,
    [monday, sunday],
  );

  return Object.fromEntries(
    rows.map((row) => [
      row.local_date,
      { caloriesKcal: row.kcal, entries: row.entries },
    ]),
  );
}
