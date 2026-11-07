import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  deleteWeightLog,
  getWeightLogs,
  upsertWeightLog,
  type UpsertWeightLogInput,
  type WeightLog,
} from '@/data/sqlite/repositories/weightRepository';

interface WeightLogsState {
  logs: WeightLog[];
  loading: boolean;
  error: string | null;
}

const LOAD_ERROR = 'No se ha podido cargar el historial de peso.';
const SAVE_ERROR = 'No se ha podido guardar el registro.';
const DELETE_ERROR = 'No se ha podido eliminar el registro.';

export function useWeightLogs() {
  const database = useSQLiteContext();
  const [state, setState] = useState<WeightLogsState>({
    logs: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const logs = await getWeightLogs(database, 100);
      setState({ logs, loading: false, error: null });
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: LOAD_ERROR,
      }));
    }
  }, [database]);

  const save = useCallback(
    async (input: UpsertWeightLogInput): Promise<void> => {
      try {
        await upsertWeightLog(database, input);
        await load();
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : SAVE_ERROR;
        throw new Error(message);
      }
    },
    [database, load],
  );

  const remove = useCallback(
    async (localDate: string): Promise<void> => {
      try {
        await deleteWeightLog(database, localDate);
        await load();
      } catch {
        throw new Error(DELETE_ERROR);
      }
    },
    [database, load],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { ...state, load, save, remove };
}
