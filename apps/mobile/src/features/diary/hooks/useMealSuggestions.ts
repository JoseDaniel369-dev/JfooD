import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getFrequentFoodsForMeal } from '@/data/sqlite/repositories/diaryRepository';
import type { MealType } from '@/features/diary/types';
import type { Food } from '@/features/foods/types';

/** The foods the person most often eats in this kind of meal, for one-tap adding. */
export function useMealSuggestions(mealType: MealType, limit = 5): Food[] {
  const database = useSQLiteContext();
  const [foods, setFoods] = useState<Food[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getFrequentFoodsForMeal(database, mealType, limit)
        .then((rows) => {
          if (!cancelled) setFoods(rows);
        })
        .catch(() => {
          // Suggestions are optional: no list is better than an error.
        });
      return () => {
        cancelled = true;
      };
    }, [database, mealType, limit]),
  );

  return foods;
}
