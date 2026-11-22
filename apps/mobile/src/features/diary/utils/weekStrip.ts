import { addDays, startOfWeek } from '@/features/diary/utils/date';

export interface WeekStripDay {
  /** YYYY-MM-DD. */
  date: string;
  /** "L", "M", "X", "J", "V", "S", "D". */
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
  isFuture: boolean;
  /** The day has at least one entry. */
  logged: boolean;
  /** Fraction of the calorie goal reached, 0 to 1 (more than 1 is capped). */
  progress: number;
}

export interface WeekStripDayData {
  /** Known calories of the day; null when the day has no entries or none has calories. */
  caloriesKcal: number | null;
  entries: number;
}

const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/**
 * The seven days (Monday to Sunday) of the week that contains `selectedDate`,
 * ready to draw. `data` holds what is known of each day, keyed by date.
 */
export function buildWeekStrip(
  selectedDate: string,
  today: string,
  goalKcal: number,
  data: Readonly<Record<string, WeekStripDayData | undefined>>,
): WeekStripDay[] {
  const monday = startOfWeek(selectedDate);

  return WEEKDAY_INITIALS.map((weekday, index) => {
    const date = addDays(monday, index);
    const day = data[date];
    const progress =
      day?.caloriesKcal != null && goalKcal > 0
        ? Math.min(Math.max(day.caloriesKcal / goalKcal, 0), 1)
        : 0;

    return {
      date,
      weekday,
      dayNumber: Number(date.slice(8, 10)),
      isToday: date === today,
      isSelected: date === selectedDate,
      isFuture: date > today,
      logged: (day?.entries ?? 0) > 0,
      progress,
    };
  });
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** "17 – 23 nov" or "28 oct – 3 nov" for the week that starts on `monday`. */
export function formatWeekRange(monday: string): string {
  const sunday = addDays(monday, 6);
  const [, startMonth, startDay] = monday.split('-').map(Number) as [number, number, number];
  const [, endMonth, endDay] = sunday.split('-').map(Number) as [number, number, number];

  const start = `${startDay}${startMonth === endMonth ? '' : ` ${MONTHS_SHORT[startMonth - 1]}`}`;
  return `${start} – ${endDay} ${MONTHS_SHORT[endMonth - 1]}`;
}
