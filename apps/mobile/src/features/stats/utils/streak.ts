import { addDays } from '@/features/diary/utils/date';

export interface StreakStats {
  current: number;
  best: number;
  totalDays: number;
}

export interface DayCalories {
  localDate: string;
  caloriesKcal: number | null;
}

export interface WeekStats {
  loggedDays: number;
  averageKcal: number | null;
  days: DayCalories[];
}

export function computeStreak(dates: string[], today: string): StreakStats {
  const logged = new Set(dates);
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
  const byDate = new Map(
    records.map((record) => [record.localDate, record.caloriesKcal]),
  );

  const days: DayCalories[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const localDate = addDays(today, offset);
    days.push({
      localDate,
      caloriesKcal: byDate.get(localDate) ?? null,
    });
  }

  const loggedDays = days.filter((day) => day.caloriesKcal !== null).length;
  const total = days.reduce<number>(
    (sum, day) => sum + (day.caloriesKcal ?? 0),
    0,
  );

  return {
    loggedDays,
    averageKcal: loggedDays > 0 ? Math.round(total / loggedDays) : null,
    days,
  };
}
