import {
  calculateNutrients,
  sumNutrients,
  type Nutrients,
} from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  DiaryDay,
  DiaryEntry,
  MealSummary,
  MealType,
  NutritionGoals,
} from '@/features/diary/types';

const DEFAULT_GOALS: NutritionGoals = {
  caloriesKcal: 2000,
  proteinGrams: 125,
  carbohydrateGrams: 250,
  fatGrams: 55,
};

const EMPTY_NUTRIENTS: Nutrients = {
  caloriesKcal: 0,
  proteinGrams: 0,
  carbohydrateGrams: 0,
  fatGrams: 0,
};

interface GoalRow {
  calories_kcal: number;
  protein_grams: number;
  carbohydrate_grams: number;
  fat_grams: number;
}

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
  const [goalRow, entryRows] = await Promise.all([
    database.getFirstAsync<GoalRow>(
      `SELECT calories_kcal, protein_grams, carbohydrate_grams, fat_grams
       FROM nutrition_goals
       WHERE effective_from <= ?
       ORDER BY effective_from DESC, id DESC
       LIMIT 1`,
      localDate,
    ),
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
  const consumed = entries.length
    ? sumNutrients(
        entries.map((entry) => calculateNutrients(entry.per100g, entry.grams)),
      )
    : EMPTY_NUTRIENTS;

  return {
    localDate,
    goals: goalRow ? mapGoals(goalRow) : DEFAULT_GOALS,
    goalsAreDefault: goalRow === null,
    entries,
    consumed,
    meals: {
      breakfast: summarizeMeal(entries, 'breakfast'),
      lunch: summarizeMeal(entries, 'lunch'),
      snack: summarizeMeal(entries, 'snack'),
      dinner: summarizeMeal(entries, 'dinner'),
    },
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

function mapGoals(row: GoalRow): NutritionGoals {
  return {
    caloriesKcal: row.calories_kcal,
    proteinGrams: row.protein_grams,
    carbohydrateGrams: row.carbohydrate_grams,
    fatGrams: row.fat_grams,
  };
}

function summarizeMeal(
  entries: readonly DiaryEntry[],
  mealType: MealType,
): MealSummary {
  const mealEntries = entries.filter((entry) => entry.mealType === mealType);

  return {
    entries: mealEntries,
    nutrients: mealEntries.length
      ? sumNutrients(
          mealEntries.map((entry) =>
            calculateNutrients(entry.per100g, entry.grams),
          ),
        )
      : EMPTY_NUTRIENTS,
  };
}
