import {
  ensureFoodInLibrary,
  findFoodByExactName,
  searchFoods,
} from '@/data/sqlite/repositories/foodRepository';
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

  // An exact name first: among thousands of branded products a ranked search may not list the
  // plain food at all. Then the old rule (exact or prefix) over the best matches.
  const match =
    (await findFoodByExactName(database, normalized)) ??
    selectFoodMatch(await searchFoods(database, normalized, 50), recognized.name);
  // A match from the big catalog is copied into the library now: the entry that
  // is saved later points at a food of the library.
  return match ? ensureFoodInLibrary(database, match) : null;
}
