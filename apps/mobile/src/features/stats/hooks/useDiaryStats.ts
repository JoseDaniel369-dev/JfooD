import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getDiaryStats, type DiaryStats } from '@/data/sqlite/repositories/statsRepository';

interface StatsState {
  stats: DiaryStats | null;
  error: string | null;
  loading: boolean;
}

const ERROR_MESSAGE = 'No se han podido cargar las estadísticas.';

export function useDiaryStats() {
  const database = useSQLiteContext();
  const [state, setState] = useState<StatsState>({
    stats: null,
    error: null,
    loading: true,
  });

  const load = useCallback(async () => {
    try {
      const stats = await getDiaryStats(database);
      setState({ stats, error: null, loading: false });
    } catch {
      setState({ stats: null, error: ERROR_MESSAGE, loading: false });
    }
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { ...state, reload: load };
}
