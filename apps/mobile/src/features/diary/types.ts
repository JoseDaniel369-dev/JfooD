import type { Nutrients } from '@jfood/core';

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
  nutrients: Nutrients;
}

export interface DiaryDay {
  localDate: string;
  goals: NutritionGoals;
  goalsAreDefault: boolean;
  entries: DiaryEntry[];
  consumed: Nutrients;
  meals: Record<MealType, MealSummary>;
}

export const MEALS: readonly { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Desayuno' },
  { type: 'lunch', label: 'Almuerzo' },
  { type: 'snack', label: 'Merienda' },
  { type: 'dinner', label: 'Cena' },
];
