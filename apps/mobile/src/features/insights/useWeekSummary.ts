import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import {
  getDailyTotals,
  getWaterTotals,
} from '@/data/sqlite/repositories/summaryRepository';
import { getWeightLogs } from '@/data/sqlite/repositories/weightRepository';
import { addDays } from '@/features/diary/utils/date';
import { useWaterGoal } from '@/features/water/hooks/useWaterGoal';

import { buildWeekSummary, type WeekSummary } from './buildWeekSummary';

interface State {
  summary: WeekSummary | null;
  goalKcal: number;
  loading: boolean;
  error: string | null;
}

/** The week that starts on `monday` in numbers, with the previous week for comparison. */
export function useWeekSummary(monday: string): State {
  const database = useSQLiteContext();
  const { goalMl } = useWaterGoal();
  const [state, setState] = useState<State>({ summary: null, goalKcal: 0, loading: true, error: null });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const sunday = addDays(monday, 6);

      void (async () => {
        try {
          const [days, previousDays, waterTotals, weights, { goals }] = await Promise.all([
            getDailyTotals(database, monday, sunday),
            getDailyTotals(database, addDays(monday, -7), addDays(monday, -1)),
            getWaterTotals(database, monday, sunday),
            getWeightLogs(database, 400),
            getLatestGoals(database, sunday),
          ]);
          if (cancelled) return;

          setState({
            summary: buildWeekSummary({
              days,
              previousDays,
              goalKcal: goals.caloriesKcal,
              waterTotals,
              waterGoalMl: goalMl,
              weights: weights.filter((log) => log.localDate >= monday && log.localDate <= sunday),
            }),
            goalKcal: goals.caloriesKcal,
            loading: false,
            error: null,
          });
        } catch {
          if (!cancelled) {
            setState({ summary: null, goalKcal: 0, loading: false, error: 'No se ha podido cargar el resumen.' });
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [database, monday, goalMl]),
  );

  return state;
}
