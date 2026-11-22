import { ensureFoodInLibrary, searchFoods } from '@/data/sqlite/repositories/foodRepository';
import { normalizeName } from '@/features/foods/utils/normalize';
import type { Food } from '@/features/foods/types';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { RecognizedFood } from '../types';

export function selectFoodMatch(
  foods: readonly Food[],
  recognizedName: string,
): Food | null {
  const normalized = normalizeName(recognizedName);
  if (!normalized) {
    return null;
  }

  const exact = foods.find((food) => food.normalizedName === normalized);
  if (exact) {
    return exact;
  }

  const prefix = foods.find((food) =>
    food.normalizedName.startsWith(`${normalized} `),
  );
  return prefix ?? null;
}

export async function findLocalFoodMatch(
  database: SQLiteDatabase,
  recognized: RecognizedFood,
): Promise<Food | null> {
  const normalized = normalizeName(recognized.name);
  if (!normalized) {
    return null;
  }

  const results = await searchFoods(database, normalized, 50);
  const match = selectFoodMatch(results, recognized.name);
  // A match from the big catalog is copied into the library now: the entry that
  // is saved later points at a food of the library.
  return match ? ensureFoodInLibrary(database, match) : null;
}
