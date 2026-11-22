export interface TrendLog {
  localDate: string;
  weightKg: number;
}

export type ChangeTone = 'good' | 'neutral' | 'attention';

/**
 * How to colour a weight change given what the person wants: losing is good for
 * "lose", gaining for "gain"; any change is neutral for "maintain" (never red:
 * a number going up or down is not an error).
 */
export function weightChangeTone(
  change: number | null,
  goalType: 'maintain' | 'lose' | 'gain' | null | undefined,
): ChangeTone {
  if (change === null || change === 0 || !goalType || goalType === 'maintain') {
    return 'neutral';
  }
  const towardsGoal = goalType === 'lose' ? change < 0 : change > 0;
  return towardsGoal ? 'good' : 'attention';
}

/**
 * Computes the absolute change between the current weight and a previous one.
 * Returns null when there is no previous value to compare.
 */
export function computeChange(
  current: number,
  previous: number | null,
): number | null {
  return previous === null ? null : Number((current - previous).toFixed(2));
}

/**
 * Computes the 7-day moving average using calendar days (inclusive).
 * Missing days are ignored: the average is over the entries that exist
 * within the last 7 days from the most recent log.
 */
export function computeWeeklyTrend(logs: readonly TrendLog[]): number | null {
  if (logs.length === 0) {
    return null;
  }

  const sorted = [...logs].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const latest = sorted[sorted.length - 1]!;
  const cutoff = addDays(latest.localDate, -6);
  const weekLogs = sorted.filter((log) => log.localDate >= cutoff);

  if (weekLogs.length === 0) {
    return null;
  }

  const average =
    weekLogs.reduce((sum, log) => sum + log.weightKg, 0) / weekLogs.length;
  return Number(average.toFixed(2));
}

function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}
