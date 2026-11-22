import {
  calculateSecondaryTargets,
  gramsSchema,
  nutrientsPer100gSchema,
  type Nutrients,
} from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  NUTRIENT_PLACEHOLDERS,
  nutrientColumnsSql,
  nutrientParams,
  nutrientsFromRow,
  type NutrientRow,
} from '@/data/sqlite/nutrientColumns';
import { getFoodById } from '@/data/sqlite/repositories/foodRepository';
import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import { generateId } from '@/data/sqlite/utils/id';
import { assertLocalDate } from '@/features/diary/utils/date';
import type { DiaryDay, DiaryEntry, MealType } from '@/features/diary/types';
import { buildMeals, summarizeEntries } from '@/features/diary/utils/summarize';
import { foodNutrients, type Food } from '@/features/foods/types';

interface EntryRow extends NutrientRow {
  id: string;
  meal_type: MealType;
  food_name: string;
  grams: number;
}

export async function getDiaryDay(
  database: SQLiteDatabase,
  localDate: string,
): Promise<DiaryDay> {
  assertLocalDate(localDate);
  const [{ goals, goalsAreDefault }, entryRows] = await Promise.all([
    getLatestGoals(database, localDate),
    database.getAllAsync<EntryRow>(
      `SELECT entry.id, meal.meal_type, entry.food_name, entry.grams,
              ${nutrientColumnsSql('entry')}
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
    targets: calculateSecondaryTargets(goals.caloriesKcal),
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
    per100g: nutrientsFromRow(row),
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
  const per100g = nutrientsPer100gSchema.parse(foodNutrients(input.food));

  const mealId = await ensureMeal(database, input.localDate, input.mealType);
  const now = new Date().toISOString();
  const id = generateId();

  await database.runAsync(
    `INSERT INTO diary_entries (
      id, meal_id, food_id, food_name, grams,
      ${nutrientColumnsSql()},
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ${NUTRIENT_PLACEHOLDERS}, ?, ?)`,
    [
      id,
      mealId,
      input.food.id,
      input.food.name,
      validGrams,
      ...nutrientParams(per100g),
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
            ${nutrientColumnsSql('entry')}
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
          ${nutrientColumnsSql()},
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ${NUTRIENT_PLACEHOLDERS}, ?, ?)`,
        [
          generateId(),
          mealId,
          row.food_id,
          row.food_name,
          row.grams,
          ...nutrientParams(nutrientsFromRow(row)),
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
  assertLocalDate(targetLocalDate);
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

/** Everything needed to put a deleted diary entry back exactly as it was. */
export interface EntrySnapshot {
  id: string;
  localDate: string;
  mealType: MealType;
  foodId: string | null;
  foodName: string;
  grams: number;
  per100g: Nutrients;
  createdAt: string;
  updatedAt: string;
}

interface SnapshotRow extends NutrientRow {
  id: string;
  local_date: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  grams: number;
  created_at: string;
  updated_at: string;
}

/**
 * Deletes a diary entry and returns what was deleted, so the screen can offer
 * "Deshacer". Returns null when the entry no longer exists.
 */
export async function removeEntry(
  database: SQLiteDatabase,
  entryId: string,
): Promise<EntrySnapshot | null> {
  const row = await database.getFirstAsync<SnapshotRow>(
    `SELECT entry.id, meal.local_date, meal.meal_type, entry.food_id, entry.food_name,
            entry.grams, entry.created_at, entry.updated_at,
            ${nutrientColumnsSql('entry')}
     FROM diary_entries AS entry
     INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
     WHERE entry.id = ?`,
    [entryId],
  );

  if (!row) {
    return null;
  }

  await database.runAsync('DELETE FROM diary_entries WHERE id = ?', [entryId]);

  return {
    id: row.id,
    localDate: row.local_date,
    mealType: row.meal_type,
    foodId: row.food_id,
    foodName: row.food_name,
    grams: row.grams,
    per100g: nutrientsFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Puts back an entry deleted with `removeEntry`, with its original id and order. */
export async function restoreEntry(
  database: SQLiteDatabase,
  snapshot: EntrySnapshot,
): Promise<void> {
  const mealId = await ensureMeal(database, snapshot.localDate, snapshot.mealType);

  // The food may have been deleted meanwhile: the entry keeps its own snapshot.
  const food = snapshot.foodId
    ? await database.getFirstAsync<{ id: string }>('SELECT id FROM foods WHERE id = ?', [
        snapshot.foodId,
      ])
    : null;

  await database.runAsync(
    `INSERT OR REPLACE INTO diary_entries (
      id, meal_id, food_id, food_name, grams,
      ${nutrientColumnsSql()},
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ${NUTRIENT_PLACEHOLDERS}, ?, ?)`,
    [
      snapshot.id,
      mealId,
      food?.id ?? null,
      snapshot.foodName,
      snapshot.grams,
      ...nutrientParams(snapshot.per100g),
      snapshot.createdAt,
      snapshot.updatedAt,
    ],
  );
}

/** Adds a copy of an entry (same meal, same amount, same snapshot) right after it. */
export async function duplicateEntry(
  database: SQLiteDatabase,
  entryId: string,
): Promise<boolean> {
  const row = await database.getFirstAsync<{ meal_id: string; food_id: string | null }>(
    'SELECT meal_id, food_id FROM diary_entries WHERE id = ?',
    [entryId],
  );
  if (!row) {
    return false;
  }

  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO diary_entries (
       id, meal_id, food_id, food_name, grams,
       ${nutrientColumnsSql()},
       created_at, updated_at
     )
     SELECT ?, meal_id, food_id, food_name, grams,
            ${nutrientColumnsSql()},
            ?, ?
     FROM diary_entries WHERE id = ?`,
    [generateId(), now, now, entryId],
  );
  return true;
}

/**
 * Foods most often logged in one kind of meal (breakfast, lunch…), most
 * frequent first: the one-tap suggestions of "Siguiente comida".
 */
export async function getFrequentFoodsForMeal(
  database: SQLiteDatabase,
  mealType: MealType,
  limit = 6,
): Promise<Food[]> {
  const rows = await database.getAllAsync<{ food_id: string }>(
    `SELECT entry.food_id
     FROM diary_entries AS entry
     INNER JOIN diary_meals AS meal ON meal.id = entry.meal_id
     INNER JOIN foods AS food ON food.id = entry.food_id
     WHERE meal.meal_type = ? AND entry.food_id IS NOT NULL
     GROUP BY entry.food_id
     ORDER BY COUNT(*) DESC, MAX(entry.created_at) DESC
     LIMIT ?`,
    [mealType, limit],
  );

  const foods: Food[] = [];
  for (const { food_id } of rows) {
    const food = await getFoodById(database, food_id);
    if (food) {
      foods.push(food);
    }
  }
  return foods;
}
