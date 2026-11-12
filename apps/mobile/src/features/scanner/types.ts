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
  recognized: RecognizedFood;
  food: Food | null;
  grams: number;
  confidence: number | null;
}
