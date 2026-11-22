import type { SQLiteDatabase } from 'expo-sqlite';

import { assertLocalDate, toLocalDate } from '@/features/diary/utils/date';

/** What was eaten on one day. Each total counts only the values that are known. */
export interface DailyTotals {
  localDate: string;
  entries: number;
  caloriesKcal: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  /** True when some entries have no calories, so `caloriesKcal` is only a minimum. */
  caloriesPartial: boolean;
}

/**
 * Totals per day for the days that have entries between two dates (inclusive).
 * A nutrient with no known value on a day is null, never zero.
 */
export async function getDailyTotals(
  database: SQLiteDatabase,
  fromLocalDate: string,
  toLocalDate: string,
): Promise<DailyTotals[]> {
  assertLocalDate(fromLocalDate);
  assertLocalDate(toLocalDate);

  const rows = await database.getAllAsync<{
    local_date: string;
    entries: number;
    known_calories: number;
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
  }>(
    `SELECT meal.local_date,
            COUNT(*) AS entries,
            COUNT(entry.calories_kcal) AS known_calories,
            SUM(entry.calories_kcal * entry.grams / 100.0) AS kcal,
            SUM(entry.protein_grams * entry.grams / 100.0) AS protein,
            SUM(entry.carbohydrate_grams * entry.grams / 100.0) AS carbs,
            SUM(entry.fat_grams * entry.grams / 100.0) AS fat,
            SUM(entry.fiber_grams * entry.grams / 100.0) AS fiber
     FROM diary_entries AS entry
     INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
     WHERE meal.local_date >= ? AND meal.local_date <= ?
     GROUP BY meal.local_date
     ORDER BY meal.local_date`,
    [fromLocalDate, toLocalDate],
  );

  return rows.map((row) => ({
    localDate: row.local_date,
    entries: row.entries,
    caloriesKcal: row.kcal,
    proteinGrams: row.protein,
    carbohydrateGrams: row.carbs,
    fatGrams: row.fat,
    fiberGrams: row.fiber,
    caloriesPartial: row.known_calories < row.entries,
  }));
}

/** Everything the achievements are computed from. */
export interface AchievementStats {
  totalEntries: number;
  /** Dates (ascending) that have at least one entry. */
  loggedDates: string[];
  /** Days that have an entry in each of the four meals. */
  daysWithAllMeals: number;
  /** Different foods that were logged at least once. */
  distinctFoods: number;
  /** Recipes created by the person. */
  recipes: number;
  /** Dates with a weight log (ascending). */
  weightDates: string[];
}

/**
 * Only days up to `today` count: entries copied to future days (a planned
 * week) are not "logged" yet and must not feed streaks or achievements.
 */
export async function getAchievementStats(
  database: SQLiteDatabase,
  today: string = toLocalDate(new Date()),
): Promise<AchievementStats> {
  assertLocalDate(today);
  const [totals, dates, allMeals, foods, recipes, weights] = await Promise.all([
    database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM diary_entries AS entry
       INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
       WHERE meal.local_date <= ?`,
      today,
    ),
    database.getAllAsync<{ local_date: string }>(
      `SELECT DISTINCT meal.local_date
       FROM diary_meals AS meal
       INNER JOIN diary_entries AS entry ON entry.meal_id = meal.id
       WHERE meal.local_date <= ?
       ORDER BY meal.local_date`,
      today,
    ),
    database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM (
         SELECT meal.local_date
         FROM diary_meals AS meal
         INNER JOIN diary_entries AS entry ON entry.meal_id = meal.id
         WHERE meal.local_date <= ?
         GROUP BY meal.local_date
         HAVING COUNT(DISTINCT meal.meal_type) = 4
       )`,
      today,
    ),
    database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT entry.food_id) AS count
       FROM diary_entries AS entry
       INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
       WHERE entry.food_id IS NOT NULL AND meal.local_date <= ?`,
      today,
    ),
    database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM foods WHERE source = 'user' AND brand = 'Receta'",
    ),
    database.getAllAsync<{ local_date: string }>(
      'SELECT local_date FROM weight_logs ORDER BY local_date',
    ),
  ]);

  return {
    totalEntries: totals?.count ?? 0,
    loggedDates: dates.map((row) => row.local_date),
    daysWithAllMeals: allMeals?.count ?? 0,
    distinctFoods: foods?.count ?? 0,
    recipes: recipes?.count ?? 0,
    weightDates: weights.map((row) => row.local_date),
  };
}

/** Total water per day (ml) for the days that have logs between two dates (inclusive). */
export async function getWaterTotals(
  database: SQLiteDatabase,
  fromLocalDate: string,
  toLocalDate: string,
): Promise<Record<string, number>> {
  assertLocalDate(fromLocalDate);
  assertLocalDate(toLocalDate);

  const rows = await database.getAllAsync<{ local_date: string; total: number }>(
    `SELECT local_date, SUM(amount_ml) AS total
     FROM water_logs
     WHERE local_date >= ? AND local_date <= ?
     GROUP BY local_date`,
    [fromLocalDate, toLocalDate],
  );

  return Object.fromEntries(rows.map((row) => [row.local_date, row.total]));
}

/** How many days (ever) reached at least `goalMl` of water. */
export async function countWaterGoalDays(
  database: SQLiteDatabase,
  goalMl: number,
): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM (
       SELECT local_date FROM water_logs GROUP BY local_date HAVING SUM(amount_ml) >= ?
     )`,
    [goalMl],
  );
  return row?.count ?? 0;
}
