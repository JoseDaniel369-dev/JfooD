import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  deleteWeightLog,
  getWeightLogs,
  upsertWeightLog,
  type UpsertWeightLogInput,
  type WeightLog,
} from '@/data/sqlite/repositories/weightRepository';
import { scheduleReminders } from '@/features/reminders/notifications';

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
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    const isFirstLoad = !hasLoaded.current;

    if (isFirstLoad) {
      setState({ logs: [], loading: true, error: null });
    } else {
      setState((current) => ({ ...current, error: null }));
    }

    try {
      const logs = await getWeightLogs(database, 100);
      hasLoaded.current = true;
      setState({ logs, loading: false, error: null });
    } catch {
      hasLoaded.current = true;
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
        void scheduleReminders(database);
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
        void scheduleReminders(database);
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
