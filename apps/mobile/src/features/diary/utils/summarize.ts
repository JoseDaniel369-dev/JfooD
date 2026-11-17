import { sumNutrients, sumNutrientsKnown } from '@jfood/core';

import type { DiaryEntry, MealSummary, MealType } from '@/features/diary/types';
import { entryNutrients } from '@/features/diary/utils/totals';

const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Strict and partial totals for a list of entries (diary or plan). */
export function summarizeEntries(entries: readonly DiaryEntry[]): MealSummary {
  const eaten = entries.map((entry) => entryNutrients(entry.per100g, entry.grams));

  return {
    entries: [...entries],
    nutrients: sumNutrients(eaten),
    partial: sumNutrientsKnown(eaten),
  };
}

export function buildMeals(
  entries: readonly DiaryEntry[],
): Record<MealType, MealSummary> {
  const meals = {} as Record<MealType, MealSummary>;

  for (const mealType of MEAL_TYPES) {
    meals[mealType] = summarizeEntries(
      entries.filter((entry) => entry.mealType === mealType),
    );
  }

  return meals;
}
