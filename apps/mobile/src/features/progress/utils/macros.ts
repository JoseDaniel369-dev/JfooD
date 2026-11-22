import type { DailyTotals } from '@/data/sqlite/repositories/summaryRepository';

export interface MacroAverage {
  /** Mean per logged day over the days where the value is known; null when no day has it. */
  grams: number | null;
  /** True when some logged day has no value (or incomplete data): the mean is a minimum. */
  approximate: boolean;
}

export interface MacroAverages {
  /** Days that have at least one entry. */
  loggedDays: number;
  protein: MacroAverage;
  carbohydrates: MacroAverage;
  fat: MacroAverage;
  fiber: MacroAverage;
  /** Share of the macro energy (4·P + 4·C + 9·G) from each macro, in whole percent; null when unknown. */
  split: { protein: number; carbohydrates: number; fat: number } | null;
}

type Field = 'proteinGrams' | 'carbohydrateGrams' | 'fatGrams' | 'fiberGrams';

function averageOf(days: readonly DailyTotals[], field: Field): MacroAverage {
  const known = days.filter((day) => day[field] !== null);
  if (known.length === 0) {
    return { grams: null, approximate: days.length > 0 };
  }

  const total = known.reduce((sum, day) => sum + (day[field] ?? 0), 0);
  return {
    grams: total / known.length,
    // Missing days, or entries without calories (which usually lack macros too).
    approximate: known.length < days.length || days.some((day) => day.caloriesPartial),
  };
}

/**
 * The average day's macros over a period. Pure: takes the per-day totals
 * (`getDailyTotals`) and never counts an unknown value as zero.
 */
export function averageMacros(days: readonly DailyTotals[]): MacroAverages {
  const protein = averageOf(days, 'proteinGrams');
  const carbohydrates = averageOf(days, 'carbohydrateGrams');
  const fat = averageOf(days, 'fatGrams');
  const fiber = averageOf(days, 'fiberGrams');

  let split: MacroAverages['split'] = null;
  if (protein.grams !== null && carbohydrates.grams !== null && fat.grams !== null) {
    const proteinKcal = protein.grams * 4;
    const carbKcal = carbohydrates.grams * 4;
    const fatKcal = fat.grams * 9;
    const total = proteinKcal + carbKcal + fatKcal;
    if (total > 0) {
      const p = Math.round((proteinKcal / total) * 100);
      const c = Math.round((carbKcal / total) * 100);
      // The last share takes the rounding remainder, so they always add up to 100
      // (and never go below 0 when two shares both round up).
      const f = 100 - p - c;
      split = f >= 0 ? { protein: p, carbohydrates: c, fat: f } : { protein: p, carbohydrates: c + f, fat: 0 };
    }
  }

  return { loggedDays: days.length, protein, carbohydrates, fat, fiber, split };
}
