import type { Nutrients, PartialNutrients } from '@jfood/core';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type NutritionGoals = {
  [Key in keyof Nutrients]: number;
};

export interface DiaryEntry {
  id: string;
  mealType: MealType;
  foodName: string;
  grams: number;
  per100g: Nutrients;
}

export interface MealSummary {
  entries: DiaryEntry[];
  /** Strict total: a nutrient is null when any entry lacks it. */
  nutrients: Nutrients;
  /** Known part of each total plus how many entries lack the value. */
  partial: PartialNutrients;
}

export interface DiaryDay {
  localDate: string;
  goals: NutritionGoals;
  goalsAreDefault: boolean;
  entries: DiaryEntry[];
  consumed: Nutrients;
  consumedPartial: PartialNutrients;
  meals: Record<MealType, MealSummary>;
}

export const MEALS: readonly { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Desayuno' },
  { type: 'lunch', label: 'Almuerzo' },
  { type: 'snack', label: 'Merienda' },
  { type: 'dinner', label: 'Cena' },
];
