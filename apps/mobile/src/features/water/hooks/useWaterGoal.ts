import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getSetting,
  setSetting,
} from '@/data/sqlite/repositories/settingsRepository';
import { DEFAULT_WATER_GOAL_ML } from '@/features/water/utils/goal';

const WATER_GOAL_KEY = 'water_goal_ml';

interface WaterGoalState {
  goalMl: number;
  loading: boolean;
}

export function useWaterGoal() {
  const database = useSQLiteContext();
  const [state, setState] = useState<WaterGoalState>({
    goalMl: DEFAULT_WATER_GOAL_ML,
    loading: true,
  });
  const isMounted = useRef(false);

  const load = useCallback(async () => {
    try {
      const stored = await getSetting(database, WATER_GOAL_KEY);
      const parsed = Number(stored);
      const goalMl =
        Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WATER_GOAL_ML;
      setState({ goalMl, loading: false });
    } catch {
      setState({ goalMl: DEFAULT_WATER_GOAL_ML, loading: false });
    }
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const setGoalMl = useCallback(
    async (goalMl: number): Promise<boolean> => {
      try {
        await setSetting(database, WATER_GOAL_KEY, String(goalMl));
        if (isMounted.current) {
          setState((current) => ({ ...current, goalMl }));
        }
        return true;
      } catch {
        return false;
      }
    },
    [database],
  );

  return { ...state, setGoalMl, reload: load };
}
