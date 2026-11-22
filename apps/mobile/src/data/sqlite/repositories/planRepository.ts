import { gramsSchema, nutrientsPer100gSchema, type Nutrients } from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  NUTRIENT_PLACEHOLDERS,
  nutrientColumnsSql,
  nutrientParams,
  nutrientsFromRow,
  type NutrientRow,
} from '@/data/sqlite/nutrientColumns';
import { ensureMeal } from '@/data/sqlite/repositories/diaryRepository';
import { generateId } from '@/data/sqlite/utils/id';
import { addDays, assertLocalDate } from '@/features/diary/utils/date';
import type { DiaryEntry, MealType } from '@/features/diary/types';
import { buildMeals, summarizeEntries } from '@/features/diary/utils/summarize';
import type { PlanDay } from '@/features/plan/types';
import { foodNutrients, type Food } from '@/features/foods/types';

interface EntryRow extends NutrientRow {
  id: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  grams: number;
}

export async function getPlanDay(
  database: SQLiteDatabase,
  localDate: string,
): Promise<PlanDay> {
  assertLocalDate(localDate);
  const rows = await database.getAllAsync<EntryRow>(
    `SELECT id, meal_type, food_name, grams,
            ${nutrientColumnsSql()}
     FROM plan_entries
     WHERE local_date = ?
     ORDER BY created_at, id`,
    localDate,
  );

  const entries = rows.map(mapEntry);
  const total = summarizeEntries(entries);

  return {
    localDate,
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

interface AddPlanEntryInput {
  localDate: string;
  mealType: MealType;
  food: Food;
  grams: number;
}

export async function addPlanEntry(
  database: SQLiteDatabase,
  input: AddPlanEntryInput,
): Promise<void> {
  assertLocalDate(input.localDate);
  const validGrams = gramsSchema.parse(input.grams);
  const per100g = nutrientsPer100gSchema.parse(foodNutrients(input.food));

  const now = new Date().toISOString();
  const id = generateId();

  await database.runAsync(
    `INSERT INTO plan_entries (
      id, local_date, meal_type, food_id, food_name, grams,
      ${nutrientColumnsSql()},
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ${NUTRIENT_PLACEHOLDERS}, ?, ?)`,
    [
      id,
      input.localDate,
      input.mealType,
      input.food.id,
      input.food.name,
      validGrams,
      ...nutrientParams(per100g),
      now,
      now,
    ],
  );
}

export async function updatePlanEntryGrams(
  database: SQLiteDatabase,
  entryId: string,
  grams: number,
): Promise<void> {
  const validGrams = gramsSchema.parse(grams);
  const now = new Date().toISOString();

  await database.runAsync(
    'UPDATE plan_entries SET grams = ?, updated_at = ? WHERE id = ?',
    [validGrams, now, entryId],
  );
}

export async function movePlanEntry(
  database: SQLiteDatabase,
  entryId: string,
  targetLocalDate: string,
  targetMealType: MealType,
): Promise<void> {
  assertLocalDate(targetLocalDate);
  const entry = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM plan_entries WHERE id = ?',
    [entryId],
  );

  if (!entry) {
    throw new Error('Entrada no encontrada.');
  }

  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE plan_entries
     SET local_date = ?, meal_type = ?, updated_at = ?
     WHERE id = ?`,
    [targetLocalDate, targetMealType, now, entryId],
  );
}

export async function deletePlanEntry(
  database: SQLiteDatabase,
  entryId: string,
): Promise<void> {
  await database.runAsync('DELETE FROM plan_entries WHERE id = ?', [entryId]);
}

export interface PlanDaySummary {
  localDate: string;
  entryCount: number;
  /** Known calories; null when the day has no entries or none has calories. */
  caloriesKcal: number | null;
  /** True when some entries have no calories (the total is a minimum). */
  partial: boolean;
}

/** Calories planned for each of the 7 days starting at `startLocalDate`. */
export async function getPlanWeek(
  database: SQLiteDatabase,
  startLocalDate: string,
): Promise<PlanDaySummary[]> {
  assertLocalDate(startLocalDate);
  const dates = Array.from({ length: 7 }, (_, index) =>
    addDays(startLocalDate, index),
  );

  const rows = await database.getAllAsync<{
    local_date: string;
    kcal: number | null;
    entries: number;
    known: number;
  }>(
    `SELECT local_date,
            SUM(calories_kcal * grams / 100.0) AS kcal,
            COUNT(*) AS entries,
            COUNT(calories_kcal) AS known
     FROM plan_entries
     WHERE local_date >= ? AND local_date <= ?
     GROUP BY local_date`,
    [dates[0]!, dates[6]!],
  );
  const byDate = new Map(rows.map((row) => [row.local_date, row]));

  return dates.map((localDate) => {
    const row = byDate.get(localDate);
    return {
      localDate,
      entryCount: row?.entries ?? 0,
      caloriesKcal: row?.kcal ?? null,
      partial: row ? row.known < row.entries : false,
    };
  });
}

/** Duplicates all planned entries of a day into another day of the plan. */
export async function copyPlanDay(
  database: SQLiteDatabase,
  fromLocalDate: string,
  toLocalDate: string,
): Promise<number> {
  assertLocalDate(fromLocalDate);
  assertLocalDate(toLocalDate);

  const rows = await database.getAllAsync<EntryRow>(
    `SELECT meal_type, food_id, food_name, grams,
            ${nutrientColumnsSql()}
     FROM plan_entries
     WHERE local_date = ?
     ORDER BY created_at, id`,
    [fromLocalDate],
  );

  if (rows.length === 0) {
    return 0;
  }

  await database.withTransactionAsync(async () => {
    for (const row of rows) {
      const now = new Date().toISOString();
      await database.runAsync(
        `INSERT INTO plan_entries (
          id, local_date, meal_type, food_id, food_name, grams,
          ${nutrientColumnsSql()},
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ${NUTRIENT_PLACEHOLDERS}, ?, ?)`,
        [
          generateId(),
          toLocalDate,
          row.meal_type,
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

export async function copyPlanToDiary(
  database: SQLiteDatabase,
  localDate: string,
): Promise<void> {
  assertLocalDate(localDate);
  const rows = await database.getAllAsync<EntryRow>(
    `SELECT meal_type, food_id, food_name, grams,
            ${nutrientColumnsSql()}
     FROM plan_entries
     WHERE local_date = ?
     ORDER BY created_at, id`,
    localDate,
  );

  if (rows.length === 0) {
    return;
  }

  await database.withTransactionAsync(async () => {
    for (const row of rows) {
      const mealId = await ensureMeal(database, localDate, row.meal_type);
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
}

/** Everything needed to put a deleted plan entry back exactly as it was. */
export interface PlanEntrySnapshot {
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

interface PlanSnapshotRow extends NutrientRow {
  id: string;
  local_date: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  grams: number;
  created_at: string;
  updated_at: string;
}

/** Deletes a plan entry and returns what was deleted, so the screen can offer "Deshacer". */
export async function removePlanEntry(
  database: SQLiteDatabase,
  entryId: string,
): Promise<PlanEntrySnapshot | null> {
  const row = await database.getFirstAsync<PlanSnapshotRow>(
    `SELECT id, local_date, meal_type, food_id, food_name, grams, created_at, updated_at,
            ${nutrientColumnsSql()}
     FROM plan_entries WHERE id = ?`,
    [entryId],
  );

  if (!row) {
    return null;
  }

  await database.runAsync('DELETE FROM plan_entries WHERE id = ?', [entryId]);

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

/** Puts back an entry deleted with `removePlanEntry`. */
export async function restorePlanEntry(
  database: SQLiteDatabase,
  snapshot: PlanEntrySnapshot,
): Promise<void> {
  assertLocalDate(snapshot.localDate);
  const food = snapshot.foodId
    ? await database.getFirstAsync<{ id: string }>('SELECT id FROM foods WHERE id = ?', [
        snapshot.foodId,
      ])
    : null;

  await database.runAsync(
    `INSERT OR REPLACE INTO plan_entries (
      id, local_date, meal_type, food_id, food_name, grams,
      ${nutrientColumnsSql()},
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ${NUTRIENT_PLACEHOLDERS}, ?, ?)`,
    [
      snapshot.id,
      snapshot.localDate,
      snapshot.mealType,
      food?.id ?? null,
      snapshot.foodName,
      snapshot.grams,
      ...nutrientParams(snapshot.per100g),
      snapshot.createdAt,
      snapshot.updatedAt,
    ],
  );
}

/** Adds a copy of a plan entry (same day, meal, amount and snapshot). */
export async function duplicatePlanEntry(
  database: SQLiteDatabase,
  entryId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  // A single statement: if the entry is already gone nothing is inserted.
  const result = await database.runAsync(
    `INSERT INTO plan_entries (
       id, local_date, meal_type, food_id, food_name, grams,
       ${nutrientColumnsSql()},
       created_at, updated_at
     )
     SELECT ?, local_date, meal_type, food_id, food_name, grams,
            ${nutrientColumnsSql()},
            ?, ?
     FROM plan_entries WHERE id = ?`,
    [generateId(), now, now, entryId],
  );
  return result.changes > 0;
}
