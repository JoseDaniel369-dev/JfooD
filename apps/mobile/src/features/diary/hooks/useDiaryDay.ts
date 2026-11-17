import { useSQLiteContext } from 'expo-sqlite';

import { getDiaryDay } from '@/data/sqlite/repositories/diaryRepository';
import { useLocalDay } from '@/features/diary/hooks/useLocalDay';

const ERROR_MESSAGE = 'No se ha podido cargar el diario local.';

export function useDiaryDay(initialDate?: string) {
  const database = useSQLiteContext();
  const { data, ...rest } = useLocalDay(
    (localDate) => getDiaryDay(database, localDate),
    ERROR_MESSAGE,
    initialDate,
  );

  return { day: data, ...rest };
}
