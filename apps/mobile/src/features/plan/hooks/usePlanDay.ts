import { useSQLiteContext } from 'expo-sqlite';

import { getPlanDay } from '@/data/sqlite/repositories/planRepository';
import { useLocalDay } from '@/features/diary/hooks/useLocalDay';

const ERROR_MESSAGE = 'No se ha podido cargar el plan del día.';

export function usePlanDay(initialDate?: string) {
  const database = useSQLiteContext();
  const { data, ...rest } = useLocalDay(
    (localDate) => getPlanDay(database, localDate),
    ERROR_MESSAGE,
    initialDate,
  );

  return { day: data, ...rest };
}
