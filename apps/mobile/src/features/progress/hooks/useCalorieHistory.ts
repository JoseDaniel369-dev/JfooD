import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import { getDailyTotals } from '@/data/sqlite/repositories/summaryRepository';
import { addDays, toLocalDate } from '@/features/diary/utils/date';
import type { BarInput } from '@/features/progress/utils/bars';

export interface CalorieHistory {
  /** One bar per day, oldest first; null where nothing was logged. */
  bars: BarInput[];
  firstDate: string;
  lastDate: string;
  goalKcal: number;
  /** Average of the days whose calories are fully known, or null. */
  averageKcal: number | null;
  loggedDays: number;
  loading: boolean;
}

/** The calories of each of the last `days` days, ready for the bar chart. */
export function useCalorieHistory(days = 30): CalorieHistory {
  const database = useSQLiteContext();
  const today = toLocalDate(new Date());
  const firstDate = addDays(today, -(days - 1));
  const [state, setState] = useState<Omit<CalorieHistory, 'firstDate' | 'lastDate'>>({
    bars: [],
    goalKcal: 0,
    averageKcal: null,
    loggedDays: 0,
    loading: true,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        try {
          const [totals, { goals }] = await Promise.all([
            getDailyTotals(database, firstDate, today),
            getLatestGoals(database, today),
          ]);
          if (cancelled) return;

          const byDate = new Map(totals.map((day) => [day.localDate, day]));
          const bars: BarInput[] = [];
          for (let offset = 0; offset < days; offset += 1) {
            const day = byDate.get(addDays(firstDate, offset));
            bars.push({
              value: day?.caloriesKcal ?? null,
              approximate: day?.caloriesPartial ?? false,
            });
          }

          const complete = totals.filter((day) => day.caloriesKcal !== null && !day.caloriesPartial);
          const average =
            complete.length === 0
              ? null
              : Math.round(
                  complete.reduce((sum, day) => sum + (day.caloriesKcal ?? 0), 0) / complete.length,
                );

          setState({
            bars,
            goalKcal: goals.caloriesKcal,
            averageKcal: average,
            loggedDays: totals.length,
            loading: false,
          });
        } catch {
          if (!cancelled) setState((current) => ({ ...current, loading: false }));
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [database, days, firstDate, today]),
  );

  return { ...state, firstDate, lastDate: today };
}
