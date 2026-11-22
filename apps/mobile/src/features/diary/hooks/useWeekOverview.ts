import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getWeekOverview } from '@/data/sqlite/repositories/statsRepository';
import { startOfWeek } from '@/features/diary/utils/date';
import type { WeekStripDayData } from '@/features/diary/utils/weekStrip';

/**
 * What was logged on each day of the week that contains `anyDate`, for the
 * week strip. It reloads when the screen gains focus, when the week changes
 * and whenever `version` changes (pass something that changes after edits).
 */
export function useWeekOverview(
  anyDate: string,
  version: string,
): Record<string, WeekStripDayData> {
  const database = useSQLiteContext();
  const [data, setData] = useState<Record<string, WeekStripDayData>>({});
  const monday = startOfWeek(anyDate);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getWeekOverview(database, monday)
        .then((overview) => {
          if (!cancelled) setData(overview);
        })
        .catch(() => {
          // The strip simply shows no marks if this fails.
        });

      return () => {
        cancelled = true;
      };
      // `version` is not read: it only makes this reload after the screen changed data.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [database, monday, version]),
  );

  return data;
}
