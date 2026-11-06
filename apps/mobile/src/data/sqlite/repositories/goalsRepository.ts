import type { SQLiteDatabase } from 'expo-sqlite';

import type { NutritionGoals } from '@jfood/core';

export interface GoalRow {
  calories_kcal: number;
  protein_grams: number;
  carbohydrate_grams: number;
  fat_grams: number;
}

const DEFAULT_GOALS: NutritionGoals = {
  caloriesKcal: 2000,
  proteinGrams: 125,
  carbohydrateGrams: 250,
  fatGrams: 55,
};

export async function getLatestGoals(
  database: SQLiteDatabase,
  localDate: string,
): Promise<{ goals: NutritionGoals; goalsAreDefault: boolean }> {
  const row = await database.getFirstAsync<GoalRow>(
    `SELECT calories_kcal, protein_grams, carbohydrate_grams, fat_grams
     FROM nutrition_goals
     WHERE effective_from <= ?
     ORDER BY effective_from DESC, id DESC
     LIMIT 1`,
    localDate,
  );

  return {
    goals: row ? mapGoals(row) : DEFAULT_GOALS,
    goalsAreDefault: row === null,
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
