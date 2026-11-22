import type { Food } from '@/features/foods/types';

export interface RecognizedFood {
  name: string;
  estimatedGrams: number;
  confidence: number | null;
}

export interface RecognitionResult {
  foods: RecognizedFood[];
  warnings: string[];
}

export interface RecognizedFoodMatch {
  /** Stable identity of the row: positions shift when a result is removed. */
  id: string;
  recognized: RecognizedFood;
  food: Food | null;
  grams: number;
  confidence: number | null;
}
