import { addDays } from './date';

export interface CopyTarget {
  /** YYYY-MM-DD */
  date: string;
  /** "Hoy", "Mañana" or "Jue 26". */
  label: string;
}

const SHORT_WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** How many days, counting today, the quick choices cover. */
export const COPY_TARGET_DAYS = 6;

function shortLabel(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return `${SHORT_WEEKDAYS[date.getDay()] ?? ''} ${date.getDate()}`;
}

/**
 * The quick choices to copy a meal to: from today over the next few days,
 * leaving out the day the meal is already on. Pure: `today` is passed in.
 */
export function buildCopyTargets(today: string, from: string): CopyTarget[] {
  const targets: CopyTarget[] = [];

  for (let offset = 0; offset < COPY_TARGET_DAYS; offset += 1) {
    const date = addDays(today, offset);
    if (date === from) continue;
    targets.push({
      date,
      label: offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : shortLabel(date),
    });
  }

  return targets;
}
