import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import {
  getSetting,
  setSetting,
} from '@/data/sqlite/repositories/settingsRepository';
import { cleanDisplayName } from '@/features/home/greeting';

export const DISPLAY_NAME_KEY = 'display_name';

/** The name the person gave to be greeted with (null when none). */
export function useDisplayName() {
  const database = useSQLiteContext();
  const [name, setName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSetting(database, DISPLAY_NAME_KEY)
        .then((stored) => {
          if (!cancelled) setName(cleanDisplayName(stored));
        })
        .catch(() => {
          // No name just means a plain greeting.
        });
      return () => {
        cancelled = true;
      };
    }, [database]),
  );

  const save = useCallback(
    async (next: string): Promise<boolean> => {
      const clean = cleanDisplayName(next);
      try {
        await setSetting(database, DISPLAY_NAME_KEY, clean ?? '');
        setName(clean);
        return true;
      } catch {
        return false;
      }
    },
    [database],
  );

  return { name, save };
}
