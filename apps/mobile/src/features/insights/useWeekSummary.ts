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
  reload: () => void;
}

interface Loaded {
  /** The week these numbers belong to. */
  monday: string;
  summary: WeekSummary | null;
  goalKcal: number;
  error: string | null;
}

/** The week that starts on `monday` in numbers, with the previous week for comparison. */
export function useWeekSummary(monday: string): State {
  const database = useSQLiteContext();
  const { goalMl } = useWaterGoal();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  /** Loads the week; returns a function that discards the result. */
  const load = useCallback(() => {
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

        setLoaded({
          monday,
          summary: buildWeekSummary({
            days,
            previousDays,
            goalKcal: goals.caloriesKcal,
            waterTotals,
            waterGoalMl: goalMl,
            weights: weights.filter((log) => log.localDate >= monday && log.localDate <= sunday),
          }),
          goalKcal: goals.caloriesKcal,
          error: null,
        });
      } catch {
        if (!cancelled) {
          setLoaded({ monday, summary: null, goalKcal: 0, error: 'No se ha podido cargar el resumen.' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [database, monday, goalMl]);

  useFocusEffect(load);

  const reload = useCallback(() => {
    setLoaded(null);
    load();
  }, [load]);

  // Numbers of another week are never shown under this week's dates.
  const current = loaded && loaded.monday === monday ? loaded : null;
  return {
    summary: current?.summary ?? null,
    goalKcal: current?.goalKcal ?? 0,
    loading: current === null,
    error: current?.error ?? null,
    reload,
  };
}
