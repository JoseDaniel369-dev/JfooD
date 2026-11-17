import { gramsSchema, nutrientsPer100gSchema } from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import { generateId } from '@/data/sqlite/utils/id';
import { assertLocalDate } from '@/features/diary/utils/date';
import type { DiaryDay, DiaryEntry, MealType } from '@/features/diary/types';
import { buildMeals, summarizeEntries } from '@/features/diary/utils/summarize';
import type { Food } from '@/features/foods/types';

interface EntryRow {
  id: string;
  meal_type: MealType;
  food_name: string;
  grams: number;
  calories_kcal: number | null;
  protein_grams: number | null;
  carbohydrate_grams: number | null;
  fat_grams: number | null;
}

export async function getDiaryDay(
  database: SQLiteDatabase,
  localDate: string,
): Promise<DiaryDay> {
  const [{ goals, goalsAreDefault }, entryRows] = await Promise.all([
    getLatestGoals(database, localDate),
    database.getAllAsync<EntryRow>(
      `SELECT entry.id, meal.meal_type, entry.food_name, entry.grams,
              entry.calories_kcal, entry.protein_grams,
              entry.carbohydrate_grams, entry.fat_grams
       FROM diary_entries AS entry
       INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
       WHERE meal.local_date = ?
       ORDER BY entry.created_at, entry.id`,
      localDate,
    ),
  ]);

  const entries = entryRows.map(mapEntry);
  const total = summarizeEntries(entries);

  return {
    localDate,
    goals,
    goalsAreDefault,
    entries,
    consumed: total.nutrients,
    consumedPartial: total.partial,
    meals: buildMeals(entries),
  };
}

function mapEntry(row: EntryRow): DiaryEntry {
  return {
    id: row.id,
    mealType: row.meal_type,
    foodName: row.food_name,
    grams: row.grams,
    per100g: {
      caloriesKcal: row.calories_kcal,
      proteinGrams: row.protein_grams,
      carbohydrateGrams: row.carbohydrate_grams,
      fatGrams: row.fat_grams,
    },
  };
}

/** Number of diary entries already logged on a date. */
export async function countDiaryEntries(
  database: SQLiteDatabase,
  localDate: string,
): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM diary_entries AS entry
     INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
     WHERE meal.local_date = ?`,
    [localDate],
  );
  return row?.count ?? 0;
}

export async function ensureMeal(
  database: SQLiteDatabase,
  localDate: string,
  mealType: MealType,
): Promise<string> {
  assertLocalDate(localDate);
  const id = generateId();
  const now = new Date().toISOString();

  const result = await database.runAsync(
    `INSERT OR IGNORE INTO diary_meals (id, local_date, meal_type, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, localDate, mealType, now],
  );

  if (result.changes > 0) {
    return id;
  }

  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM diary_meals WHERE local_date = ? AND meal_type = ?',
    [localDate, mealType],
  );

  if (!existing) {
    throw new Error('No se ha podido asegurar la comida del diario.');
  }

  return existing.id;
}

interface AddEntryInput {
  localDate: string;
  mealType: MealType;
  food: Food;
  grams: number;
}

export async function addEntry(
  database: SQLiteDatabase,
  input: AddEntryInput,
): Promise<void> {
  const validGrams = gramsSchema.parse(input.grams);
  const per100g = nutrientsPer100gSchema.parse({
    caloriesKcal: input.food.caloriesKcal,
    proteinGrams: input.food.proteinGrams,
    carbohydrateGrams: input.food.carbohydrateGrams,
    fatGrams: input.food.fatGrams,
  });

  const mealId = await ensureMeal(database, input.localDate, input.mealType);
  const now = new Date().toISOString();
  const id = generateId();

  await database.runAsync(
    `INSERT INTO diary_entries (
      id, meal_id, food_id, food_name, grams,
      calories_kcal, protein_grams, carbohydrate_grams, fat_grams,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      mealId,
      input.food.id,
      input.food.name,
      validGrams,
      per100g.caloriesKcal,
      per100g.proteinGrams,
      per100g.carbohydrateGrams,
      per100g.fatGrams,
      now,
      now,
    ],
  );
}

/**
 * Copies the entries of one day (optionally one meal) to another day, keeping
 * their nutrient snapshots. Returns how many entries were copied.
 */
export async function copyDiaryDay(
  database: SQLiteDatabase,
  fromLocalDate: string,
  toLocalDate: string,
  mealType?: MealType,
): Promise<number> {
  assertLocalDate(fromLocalDate);
  assertLocalDate(toLocalDate);

  const rows = await database.getAllAsync<
    EntryRow & { food_id: string | null }
  >(
    `SELECT entry.id, meal.meal_type, entry.food_id, entry.food_name, entry.grams,
            entry.calories_kcal, entry.protein_grams,
            entry.carbohydrate_grams, entry.fat_grams
     FROM diary_entries AS entry
     INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
     WHERE meal.local_date = ? AND (? IS NULL OR meal.meal_type = ?)
     ORDER BY entry.created_at, entry.id`,
    [fromLocalDate, mealType ?? null, mealType ?? null],
  );

  if (rows.length === 0) {
    return 0;
  }

  await database.withTransactionAsync(async () => {
    for (const row of rows) {
      const mealId = await ensureMeal(database, toLocalDate, row.meal_type);
      const now = new Date().toISOString();

      await database.runAsync(
        `INSERT INTO diary_entries (
          id, meal_id, food_id, food_name, grams,
          calories_kcal, protein_grams, carbohydrate_grams, fat_grams,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          mealId,
          row.food_id,
          row.food_name,
          row.grams,
          row.calories_kcal,
          row.protein_grams,
          row.carbohydrate_grams,
          row.fat_grams,
          now,
          now,
        ],
      );
    }
  });

  return rows.length;
}

export async function updateEntryGrams(
  database: SQLiteDatabase,
  entryId: string,
  grams: number,
): Promise<void> {
  const validGrams = gramsSchema.parse(grams);
  const now = new Date().toISOString();

  await database.runAsync(
    'UPDATE diary_entries SET grams = ?, updated_at = ? WHERE id = ?',
    [validGrams, now, entryId],
  );
}

export async function moveEntry(
  database: SQLiteDatabase,
  entryId: string,
  targetLocalDate: string,
  targetMealType: MealType,
): Promise<void> {
  const entry = await database.getFirstAsync<{ meal_id: string }>(
    'SELECT meal_id FROM diary_entries WHERE id = ?',
    [entryId],
  );

  if (!entry) {
    throw new Error('Entrada no encontrada.');
  }

  const targetMealId = await ensureMeal(
    database,
    targetLocalDate,
    targetMealType,
  );

  if (entry.meal_id === targetMealId) {
    return;
  }

  const now = new Date().toISOString();

  await database.runAsync(
    'UPDATE diary_entries SET meal_id = ?, updated_at = ? WHERE id = ?',
    [targetMealId, now, entryId],
  );
}

export async function deleteEntry(
  database: SQLiteDatabase,
  entryId: string,
): Promise<void> {
  await database.runAsync('DELETE FROM diary_entries WHERE id = ?', [entryId]);
}
