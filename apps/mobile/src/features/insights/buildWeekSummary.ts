import type { DailyTotals } from '@/data/sqlite/repositories/summaryRepository';

export interface WeekSummaryInput {
  /** Days of the week with entries (Monday to Sunday). */
  days: readonly DailyTotals[];
  /** Days of the previous week with entries. */
  previousDays: readonly DailyTotals[];
  goalKcal: number;
  /** Water per day (ml) for the days of the week that have logs. */
  waterTotals: Readonly<Record<string, number>>;
  waterGoalMl: number;
  /** Weight logs of the week, any order. */
  weights: readonly { localDate: string; weightKg: number }[];
}

export interface DayFigure {
  localDate: string;
  caloriesKcal: number;
}

export interface MacroSplit {
  proteinPercent: number;
  carbohydratePercent: number;
  fatPercent: number;
}

export interface WeekSummary {
  loggedDays: number;
  /** Average of the days whose calories are fully known; null when there are none. */
  averageKcal: number | null;
  /** Days (with all calories known) within 10 % of the goal. */
  daysOnTarget: number;
  /** Days whose calories are fully known (the base of the two figures above). */
  comparableDays: number;
  /** The comparable day closest to the goal. */
  closestToGoal: DayFigure | null;
  /** The comparable day with the most calories. */
  highestDay: DayFigure | null;
  /** Where the energy of the macros came from; null when no macro is known. */
  macroSplit: MacroSplit | null;
  averageProteinGrams: number | null;
  /** This week's average minus the previous week's; null when either is unknown. */
  kcalChangeVsPrevious: number | null;
  /** Average water of the days that have logs, in ml. */
  averageWaterMl: number | null;
  waterGoalDays: number;
  /** Last weight minus first of the week; null with fewer than two logs. */
  weightChangeKg: number | null;
}

const TARGET_TOLERANCE = 0.1;

/** Days whose calories are completely known. */
function comparable(days: readonly DailyTotals[]): (DailyTotals & { caloriesKcal: number })[] {
  return days.filter(
    (day): day is DailyTotals & { caloriesKcal: number } =>
      day.caloriesKcal !== null && !day.caloriesPartial,
  );
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * The week in numbers. Pure. It only compares days whose calories are fully
 * known: a day with a food without calories would look better than it was.
 */
export function buildWeekSummary(input: WeekSummaryInput): WeekSummary {
  const { days, previousDays, goalKcal, waterTotals, waterGoalMl, weights } = input;

  const complete = comparable(days);
  const averageKcal = average(complete.map((day) => day.caloriesKcal));
  const previousAverage = average(comparable(previousDays).map((day) => day.caloriesKcal));

  const onTarget = complete.filter(
    (day) => goalKcal > 0 && Math.abs(day.caloriesKcal - goalKcal) <= goalKcal * TARGET_TOLERANCE,
  );

  const closest = [...complete].sort(
    (a, b) => Math.abs(a.caloriesKcal - goalKcal) - Math.abs(b.caloriesKcal - goalKcal),
  )[0];
  const highest = [...complete].sort((a, b) => b.caloriesKcal - a.caloriesKcal)[0];

  const sum = (pick: (day: DailyTotals) => number | null) =>
    days.reduce((total, day) => total + (pick(day) ?? 0), 0);
  const proteinKcal = sum((day) => day.proteinGrams) * 4;
  const carbohydrateKcal = sum((day) => day.carbohydrateGrams) * 4;
  const fatKcal = sum((day) => day.fatGrams) * 9;
  const macroKcal = proteinKcal + carbohydrateKcal + fatKcal;

  const proteinDays = days.filter((day) => day.proteinGrams !== null);

  const waterDays = Object.values(waterTotals).filter((ml) => ml > 0);
  const sortedWeights = [...weights].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const firstWeight = sortedWeights[0];
  const lastWeight = sortedWeights[sortedWeights.length - 1];

  return {
    loggedDays: days.filter((day) => day.entries > 0).length,
    averageKcal: averageKcal === null ? null : Math.round(averageKcal),
    daysOnTarget: onTarget.length,
    comparableDays: complete.length,
    closestToGoal: closest ? { localDate: closest.localDate, caloriesKcal: Math.round(closest.caloriesKcal) } : null,
    highestDay: highest ? { localDate: highest.localDate, caloriesKcal: Math.round(highest.caloriesKcal) } : null,
    macroSplit:
      macroKcal > 0
        ? {
            proteinPercent: Math.round((proteinKcal / macroKcal) * 100),
            carbohydratePercent: Math.round((carbohydrateKcal / macroKcal) * 100),
            fatPercent: Math.round((fatKcal / macroKcal) * 100),
          }
        : null,
    averageProteinGrams: (() => {
      const mean = average(proteinDays.map((day) => day.proteinGrams as number));
      return mean === null ? null : Math.round(mean);
    })(),
    kcalChangeVsPrevious:
      averageKcal === null || previousAverage === null
        ? null
        : Math.round(averageKcal) - Math.round(previousAverage),
    averageWaterMl: (() => {
      const mean = average(waterDays);
      return mean === null ? null : Math.round(mean);
    })(),
    waterGoalDays: waterGoalMl > 0 ? Object.values(waterTotals).filter((ml) => ml >= waterGoalMl).length : 0,
    weightChangeKg:
      firstWeight && lastWeight && firstWeight !== lastWeight
        ? Math.round((lastWeight.weightKg - firstWeight.weightKg) * 10) / 10
        : null,
  };
}
