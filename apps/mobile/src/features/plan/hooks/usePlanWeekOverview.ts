import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getPlanWeek } from '@/data/sqlite/repositories/planRepository';
import { startOfWeek } from '@/features/diary/utils/date';
import type { WeekStripDayData } from '@/features/diary/utils/weekStrip';

/**
 * What is planned on each day of the week that contains `anyDate`, for the
 * week strip. Reloads when the week changes or `version` does.
 */
export function usePlanWeekOverview(
  anyDate: string,
  version: string,
): Record<string, WeekStripDayData> {
  const database = useSQLiteContext();
  const [data, setData] = useState<Record<string, WeekStripDayData>>({});
  const monday = startOfWeek(anyDate);

  useEffect(() => {
    let cancelled = false;

    getPlanWeek(database, monday)
      .then((summary) => {
        if (cancelled) return;
        setData(
          Object.fromEntries(
            summary
              .filter((day) => day.entryCount > 0)
              .map((day) => [
                day.localDate,
                { caloriesKcal: day.caloriesKcal, entries: day.entryCount },
              ]),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setData({});
      });

    return () => {
      cancelled = true;
    };
    // `version` is not read: it only makes this reload after the plan changed.
  }, [database, monday, version]);

  return data;
}
