import type { MealType } from '@/features/diary/types';

/**
 * Meal most likely being logged at a given hour (0-23):
 * breakfast 5-10, lunch 11-15, snack 16-19, dinner otherwise.
 */
export function defaultMealForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 20) return 'snack';
  return 'dinner';
}

export function currentDefaultMeal(now: Date = new Date()): MealType {
  return defaultMealForHour(now.getHours());
}
