import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getDiaryDay } from '@/data/sqlite/repositories/diaryRepository';
import { toLocalDate } from '@/features/diary/utils/date';
import type { DiaryDay } from '@/features/diary/types';

interface DiaryDayState {
  day: DiaryDay | null;
  error: string | null;
  loading: boolean;
}

const ERROR_MESSAGE = 'No se ha podido cargar el diario local.';

export function useDiaryDay(initialDate?: string) {
  const database = useSQLiteContext();
  const todayAtMount = toLocalDate(new Date());
  const [localDate, setLocalDate] = useState(initialDate ?? todayAtMount);
  const [state, setState] = useState<DiaryDayState>({
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
    () => getDiaryDay(database, localDateRef.current),
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
