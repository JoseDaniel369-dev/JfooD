import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getPlanDay } from '@/data/sqlite/repositories/planRepository';
import { toLocalDate } from '@/features/diary/utils/date';
import type { PlanDay } from '@/features/plan/types';

interface PlanDayState {
  day: PlanDay | null;
  error: string | null;
  loading: boolean;
}

const ERROR_MESSAGE = 'No se ha podido cargar el plan del día.';

export function usePlanDay(initialDate?: string) {
  const database = useSQLiteContext();
  const todayAtMount = toLocalDate(new Date());
  const [localDate, setLocalDate] = useState(initialDate ?? todayAtMount);
  const [state, setState] = useState<PlanDayState>({
    day: null,
    error: null,
    loading: true,
  });

  const localDateRef = useRef(localDate);
  const lastTodayRef = useRef(todayAtMount);

  useEffect(() => {
    localDateRef.current = localDate;
  }, [localDate]);

  const loadDay = useCallback(
    () => getPlanDay(database, localDateRef.current),
    [database],
  );

  const reload = useCallback(async () => {
    const date = localDateRef.current;

    setState((current) => ({
      ...current,
      error: null,
      loading: current.day === null,
    }));

    try {
      const day = await loadDay();
      if (localDateRef.current === date) {
        setState({ day, error: null, loading: false });
      }
    } catch {
      if (localDateRef.current === date) {
        setState({ day: null, error: ERROR_MESSAGE, loading: false });
      }
    }
  }, [loadDay]);

  const refresh = useCallback(async () => {
    const date = localDateRef.current;

    try {
      const day = await loadDay();
      if (localDateRef.current === date) {
        setState({ day, error: null, loading: false });
      }
    } catch {
      if (localDateRef.current === date) {
        setState({ day: null, error: ERROR_MESSAGE, loading: false });
      }
    }
  }, [loadDay]);

  // Reload the day whenever the selected date changes (day navigation or the
  // midnight rollover). The first run is skipped because the focus effect
  // below already loads the day on mount.
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    void reload();
  }, [localDate, reload]);

  useEffect(() => {
    const refreshLocalDate = () => {
      const nextDate = toLocalDate(new Date());
      const previousToday = lastTodayRef.current;

      if (nextDate === previousToday) {
        return;
      }

      lastTodayRef.current = nextDate;

      setLocalDate((currentDate) =>
        currentDate === previousToday ? nextDate : currentDate,
      );
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        if (nextAppState === 'active') {
          refreshLocalDate();
        }
      },
    );
    const interval = setInterval(refreshLocalDate, 60_000);

    return () => {
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { ...state, localDate, setLocalDate, reload, refresh };
}
