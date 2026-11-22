import { MAX_WATER_LOG_ML } from '@/data/sqlite/repositories/waterRepository';
import { parseSpanishNumber } from '@/features/foods/utils/parseNumber';

export const DEFAULT_WATER_GOAL_ML = 2000;

export const WATER_QUICK_ADD_OPTIONS = [250, 500] as const;

/** Extra amounts offered in the "other amount" sheet (a small glass, a can, a big bottle). */
export const WATER_EXTRA_PRESETS = [150, 330, 750] as const;

/**
 * An amount of water typed in millilitres ("330", "330 ml"), or null when it is
 * empty, not a number, or outside 1 ml … the largest single record.
 */
export function parseWaterAmount(value: string): number | null {
  // "1.500" is a Spanish thousands separator (1500 ml). A fraction ("1,5") is
  // ambiguous (litres?), so it is refused instead of guessed.
  const parsed = parseSpanishNumber(value.replace(/ml/i, ''), { thousands: true });
  if (parsed === null || !Number.isInteger(parsed)) return null;

  return parsed >= 1 && parsed <= MAX_WATER_LOG_ML ? parsed : null;
}

const MIN_GOAL_ML = 250;
export const MAX_GOAL_ML = 6000;

export function parseWaterGoal(value: string): number | null {
  // "2.000" is 2000 and "1,5" is a decimal (see parseSpanishNumber).
  const parsed = parseSpanishNumber(value, { thousands: true });
  if (parsed === null) return null;
  return Math.min(Math.max(Math.round(parsed), MIN_GOAL_ML), MAX_GOAL_ML);
}
