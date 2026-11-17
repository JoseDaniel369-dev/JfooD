import type { Nutrients, PartialNutrients } from '@jfood/core';

import type { DiaryEntry, MealSummary, MealType } from '@/features/diary/types';

export interface PlanDay {
  localDate: string;
  entries: DiaryEntry[];
  consumed: Nutrients;
  consumedPartial: PartialNutrients;
  meals: Record<MealType, MealSummary>;
}
