export const DEFAULT_WATER_GOAL_ML = 2000;

export const WATER_QUICK_ADD_OPTIONS = [250, 500] as const;

const MIN_GOAL_ML = 250;
export const MAX_GOAL_ML = 6000;

export function parseWaterGoal(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  let normalized: string;
  if (trimmed.includes(',')) {
    // Spanish decimal separator: '.' are thousands, ',' is decimal.
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    // Thousands separator only (e.g. 2.000 → 2000).
    normalized = trimmed.replace(/\./g, '');
  } else {
    // Decimal point or plain integer.
    normalized = trimmed;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.round(parsed), MIN_GOAL_ML), MAX_GOAL_ML);
}
