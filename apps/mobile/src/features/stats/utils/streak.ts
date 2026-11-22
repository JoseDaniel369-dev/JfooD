import { addDays } from '@/features/diary/utils/date';

export interface StreakStats {
  current: number;
  best: number;
  totalDays: number;
}

export interface DayCalories {
  localDate: string;
  /** Sum of the calories that are known; null when nothing is known. */
  caloriesKcal: number | null;
  /** True when some entries of the day have no calories (total is a minimum). */
  partial?: boolean;
  /** True when the day has any entry. Defaults to caloriesKcal !== null. */
  logged?: boolean;
}

export interface WeekStats {
  loggedDays: number;
  averageKcal: number | null;
  days: DayCalories[];
}

export function computeStreak(dates: string[], today: string): StreakStats {
  // Days after today (entries copied ahead) are not logged yet.
  const logged = new Set(dates.filter((date) => date <= today));
  const totalDays = logged.size;

  const anchor = logged.has(today) ? today : addDays(today, -1);
  let current = 0;
  let cursor = anchor;
  while (logged.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of [...logged].sort()) {
    if (previous !== null && addDays(previous, 1) === date) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    previous = date;
  }

  return { current, best, totalDays };
}

export function computeWeekStats(
  records: DayCalories[],
  today: string,
): WeekStats {
  const byDate = new Map(records.map((record) => [record.localDate, record]));

  const days: DayCalories[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const localDate = addDays(today, offset);
    const record = byDate.get(localDate);
    days.push({
      localDate,
      caloriesKcal: record?.caloriesKcal ?? null,
      partial: record?.partial ?? false,
      logged: record ? (record.logged ?? record.caloriesKcal !== null) : false,
    });
  }

  const loggedDays = days.filter((day) => day.logged).length;
  // Only complete days enter the average: a partial day would understate it.
  const complete = days.filter((day) => day.caloriesKcal !== null && !day.partial);
  const total = complete.reduce<number>(
    (sum, day) => sum + (day.caloriesKcal ?? 0),
    0,
  );

  return {
    loggedDays,
    averageKcal: complete.length > 0 ? Math.round(total / complete.length) : null,
    days,
  };
}
