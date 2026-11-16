import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  addWater,
  deleteWaterLog,
  getWaterDay,
  type WaterDay,
} from '@/data/sqlite/repositories/waterRepository';
import { toLocalDate } from '@/features/diary/utils/date';

interface WaterDayState {
  day: WaterDay | null;
  error: string | null;
  loading: boolean;
}

const ERROR_MESSAGE = 'No se ha podido cargar el registro de agua.';

export function useWaterDay(initialDate?: string) {
  const database = useSQLiteContext();
  const todayAtMount = toLocalDate(new Date());
  const [localDate, setLocalDate] = useState(initialDate ?? todayAtMount);
  const [state, setState] = useState<WaterDayState>({
    day: null,
    error: null,
    loading: true,
  });

  const localDateRef = useRef(localDate);
  const lastTodayRef = useRef(todayAtMount);

  useEffect(() => {
    localDateRef.current = localDate;
  }, [localDate]);

  const reload = useCallback(async () => {
    const date = localDateRef.current;

    try {
      const day = await getWaterDay(database, date);
      if (localDateRef.current === date) {
        setState({ day, error: null, loading: false });
      }
    } catch {
      if (localDateRef.current === date) {
        setState({ day: null, error: ERROR_MESSAGE, loading: false });
      }
    }
  }, [database]);

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

  const add = useCallback(
    async (amountMl: number): Promise<boolean> => {
      try {
        await addWater(database, localDateRef.current, amountMl);
        await reload();
        return true;
      } catch {
        return false;
      }
    },
    [database, reload],
  );

  const remove = useCallback(
    async (logId: string): Promise<boolean> => {
      try {
        await deleteWaterLog(database, logId);
        await reload();
        return true;
      } catch {
        return false;
      }
    },
    [database, reload],
  );

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    void reload();
  }, [localDate, reload]);

  return { ...state, localDate, setLocalDate, reload, add, remove };
}
