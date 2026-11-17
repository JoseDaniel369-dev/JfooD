import { useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  addWater,
  deleteWaterLog,
  getWaterDay,
} from '@/data/sqlite/repositories/waterRepository';
import { useLocalDay } from '@/features/diary/hooks/useLocalDay';

const ERROR_MESSAGE = 'No se ha podido cargar el registro de agua.';

export function useWaterDay(initialDate?: string) {
  const database = useSQLiteContext();
  const { data, localDate, ...rest } = useLocalDay(
    (date) => getWaterDay(database, date),
    ERROR_MESSAGE,
    initialDate,
  );
  const { reload } = rest;

  const add = useCallback(
    async (amountMl: number): Promise<boolean> => {
      try {
        await addWater(database, localDate, amountMl);
        await reload();
        return true;
      } catch {
        return false;
      }
    },
    [database, localDate, reload],
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

  return { day: data, localDate, ...rest, add, remove };
}
