import type { SQLiteDatabase } from 'expo-sqlite';

import type { MealType } from '@/features/diary/types';
import { assertLocalDate } from '@/features/diary/utils/date';

export interface ReminderContext {
  /** Meals that already have at least one entry on the day. */
  loggedMealsToday: MealType[];
  /** True when a weight was logged on the day. */
  weighedToday: boolean;
}

/** What is already done today, so its reminder can be skipped. */
export async function getReminderContext(
  database: SQLiteDatabase,
  localDate: string,
): Promise<ReminderContext> {
  assertLocalDate(localDate);

  const [meals, weight] = await Promise.all([
    database.getAllAsync<{ meal_type: MealType }>(
      `SELECT DISTINCT meal.meal_type
       FROM diary_meals AS meal
       INNER JOIN diary_entries AS entry ON entry.meal_id = meal.id
       WHERE meal.local_date = ?`,
      [localDate],
    ),
    database.getFirstAsync<{ found: number }>(
      'SELECT 1 AS found FROM weight_logs WHERE local_date = ? LIMIT 1',
      [localDate],
    ),
  ]);

  return {
    loggedMealsToday: meals.map((row) => row.meal_type),
    weighedToday: weight !== null,
  };
}
