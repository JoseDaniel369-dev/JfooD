import type { Nutrients } from '@jfood/core';

import type { DiaryEntry, MealSummary, MealType } from '@/features/diary/types';

export interface PlanDay {
  localDate: string;
  entries: DiaryEntry[];
  consumed: Nutrients;
  meals: Record<MealType, MealSummary>;
}
