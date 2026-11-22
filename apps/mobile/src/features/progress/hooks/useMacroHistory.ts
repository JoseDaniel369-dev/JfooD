import { calculateSecondaryTargets, type NutritionGoals } from '@jfood/core';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import { getDailyTotals } from '@/data/sqlite/repositories/summaryRepository';
import { addDays, toLocalDate } from '@/features/diary/utils/date';

import { averageMacros, type MacroAverages } from '../utils/macros';

interface MacroHistory {
  averages: MacroAverages | null;
  goals: NutritionGoals | null;
  /** Daily fibre reference derived from the calorie goal. */
  fiberTargetGrams: number;
  /** The period these numbers are for (so a stale period is never shown under another). */
  days: number;
  failed: boolean;
}

/** Average macros of the last `days` days, with the goals they are compared to. */
export function useMacroHistory(days: number): MacroHistory & { loading: boolean } {
  const database = useSQLiteContext();
  const [state, setState] = useState<MacroHistory | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const today = toLocalDate(new Date());

      void (async () => {
        try {
          const [totals, { goals }] = await Promise.all([
            getDailyTotals(database, addDays(today, -(days - 1)), today),
            getLatestGoals(database, today),
          ]);
          if (cancelled) return;

          setState({
            averages: averageMacros(totals),
            goals,
            fiberTargetGrams: calculateSecondaryTargets(goals.caloriesKcal).fiberGrams,
            days,
            failed: false,
          });
        } catch {
          if (!cancelled) {
            setState({ averages: null, goals: null, fiberTargetGrams: 0, days, failed: true });
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [database, days]),
  );

  const current = state && state.days === days ? state : null;
  return {
    averages: current?.averages ?? null,
    goals: current?.goals ?? null,
    fiberTargetGrams: current?.fiberTargetGrams ?? 0,
    days,
    failed: current?.failed ?? false,
    loading: current === null,
  };
}
