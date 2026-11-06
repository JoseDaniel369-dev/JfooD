import { useCallback, useEffect, useState } from 'react';
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

export function useDiaryDay() {
  const database = useSQLiteContext();
  const [localDate, setLocalDate] = useState(() => toLocalDate(new Date()));
  const [state, setState] = useState<DiaryDayState>({
    day: null,
    error: null,
    loading: true,
  });

  const loadDay = useCallback(
    () => getDiaryDay(database, localDate),
    [database, localDate],
  );

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, error: null, loading: true }));

    try {
      const day = await loadDay();
      setState({ day, error: null, loading: false });
    } catch {
      setState({ day: null, error: ERROR_MESSAGE, loading: false });
    }
  }, [loadDay]);

  useEffect(() => {
    const refreshLocalDate = () => {
      const nextDate = toLocalDate(new Date());
      setLocalDate((currentDate) =>
        currentDate === nextDate ? currentDate : nextDate,
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

  useEffect(() => {
    let active = true;

    void loadDay()
      .then((day) => {
        if (active) {
          setState({ day, error: null, loading: false });
        }
      })
      .catch(() => {
        if (active) {
          setState({ day: null, error: ERROR_MESSAGE, loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, [loadDay]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { ...state, localDate, reload };
}
