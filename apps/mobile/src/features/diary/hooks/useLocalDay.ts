import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { toLocalDate } from '@/features/diary/utils/date';

interface LocalDayState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Shared behaviour of the screens that show one day of data (diary, plan,
 * water): a selected local date, reload on focus and on date change, silent
 * refresh after writes, and automatic rollover when midnight passes while the
 * app is open or goes to the background.
 */
export function useLocalDay<T>(
  load: (localDate: string) => Promise<T>,
  errorMessage: string,
  initialDate?: string,
) {
  const todayAtMount = toLocalDate(new Date());
  const [localDate, setLocalDate] = useState(initialDate ?? todayAtMount);
  const [state, setState] = useState<LocalDayState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const localDateRef = useRef(localDate);
  const lastTodayRef = useRef(todayAtMount);
  const loadRef = useRef(load);

  useEffect(() => {
    localDateRef.current = localDate;
  }, [localDate]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  /** Loads the selected day; `showLoading` only applies before any data exists. */
  const run = useCallback(
    async (showLoading: boolean) => {
      const date = localDateRef.current;

      if (showLoading) {
        setState((current) => ({
          ...current,
          error: null,
          loading: current.data === null,
        }));
      }

      try {
        const data = await loadRef.current(date);
        if (localDateRef.current === date) {
          setState({ data, error: null, loading: false });
        }
      } catch {
        if (localDateRef.current === date) {
          setState({ data: null, error: errorMessage, loading: false });
        }
      }
    },
    [errorMessage],
  );

  const reload = useCallback(() => run(true), [run]);
  const refresh = useCallback(() => run(false), [run]);

  // Reload whenever the selected date changes. The first run is skipped because
  // the focus effect below already loads the day on mount.
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    // Another day: never keep showing the previous day's data under the new date.
    setState({ data: null, error: null, loading: true });
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

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshLocalDate();
      }
    });
    const interval = setInterval(refreshLocalDate, 60_000);

    return () => {
      subscription.remove();
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
