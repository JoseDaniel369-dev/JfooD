import {
  calculateNutrients,
  type Nutrients,
  type PartialNutrient,
  type PartialNutrients,
  type SecondaryTargets,
  unknownNutrients,
} from '@jfood/core';

export const UNKNOWN_NUTRIENTS: Nutrients = unknownNutrients();

/**
 * Nutrients eaten for one entry. A row that cannot be validated (corrupt or
 * legacy data) is reported as fully unknown instead of breaking the whole day.
 */
export function entryNutrients(per100g: Nutrients, grams: number): Nutrients {
  try {
    return calculateNutrients(per100g, grams);
  } catch {
    return UNKNOWN_NUTRIENTS;
  }
}

/**
 * "1250" when the total is complete, "≥ 1250" when some values are unknown and
 * "—" when nothing at all is known.
 */
export function formatPartialAmount(partial: PartialNutrient): string {
  const rounded = Math.round(partial.knownTotal);
  if (partial.complete) {
    return String(rounded);
  }
  return rounded === 0 ? '—' : `≥ ${rounded}`;
}

/** "1 alimento sin calorías", "3 alimentos sin calorías" or null when complete. */
export function describeUnknown(
  partial: PartialNutrient,
  nutrient = 'calorías',
): string | null {
  if (partial.complete) {
    return null;
  }

  const count = partial.unknownCount;
  return count === 1
    ? `1 alimento sin ${nutrient}`
    : `${count} alimentos sin ${nutrient}`;
}

export interface RemainingCalories {
  /** Absolute amount, already rounded. */
  amount: number;
  /** True when the goal is certainly exceeded. */
  over: boolean;
  /** True when the amount is only a bound because some foods have no calories. */
  approximate: boolean;
}

/**
 * Calories left (or exceeded) for the day.
 * With unknown foods the known part is a lower bound of what was eaten, so a
 * result under the goal is only an upper bound of what remains.
 */
export function remainingCalories(
  goalKcal: number,
  partial: PartialNutrient,
): RemainingCalories {
  const difference = goalKcal - partial.knownTotal;
  return {
    amount: Math.round(Math.abs(difference)),
    over: difference < 0,
    approximate: !partial.complete,
  };
}

/** Text for the remaining-calories row: "Restantes", "Por encima del objetivo", … */
export function remainingLabel(remaining: RemainingCalories): string {
  if (remaining.over) {
    return 'Por encima del objetivo';
  }
  return remaining.approximate ? 'Restantes (como máximo)' : 'Restantes';
}

/** "720 kcal" or "≤ 720 kcal" / "≥ 120 kcal" when the value is approximate. */
export function formatRemaining(remaining: RemainingCalories): string {
  if (!remaining.approximate) {
    return `${remaining.amount} kcal`;
  }
  return `${remaining.over ? '≥' : '≤'} ${remaining.amount} kcal`;
}

/** Grams for display with a Spanish decimal comma: "28", "3,1", "0,4". */
export function formatGrams(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}

export interface ExtraTotal {
  key: 'fiberGrams' | 'sugarsGrams' | 'saltGrams';
  label: string;
  /** "28" or "≥ 28": the amount eaten, a lower bound when data is missing. */
  amount: string;
  /** "25 g mín." / "50 g máx.": the daily reference. */
  target: string;
  /** True when a maximum (sugars, salt) is already exceeded. */
  exceeded: boolean;
}

/**
 * Fibre, sugars and salt of a day against their references. A nutrient with no
 * known value at all is left out instead of showing a misleading 0.
 */
export function describeExtras(
  partial: Pick<PartialNutrients, 'fiberGrams' | 'sugarsGrams' | 'saltGrams'>,
  targets: SecondaryTargets,
  hasEntries: boolean,
): ExtraTotal[] {
  if (!hasEntries) {
    return [];
  }

  const rows: ExtraTotal[] = [];
  const definitions = [
    { key: 'fiberGrams', label: 'Fibra', target: `${targets.fiberGrams} g mín.`, max: null },
    { key: 'sugarsGrams', label: 'Azúcares', target: `${targets.sugarsGrams} g máx.`, max: targets.sugarsGrams },
    { key: 'saltGrams', label: 'Sal', target: `${targets.saltGrams} g máx.`, max: targets.saltGrams },
  ] as const;

  for (const { key, label, target, max } of definitions) {
    const value = partial[key];
    if (value.knownTotal === 0 && !value.complete) {
      continue;
    }
    rows.push({
      key,
      label,
      amount: `${value.complete ? '' : '≥ '}${formatGrams(value.knownTotal)}`,
      target,
      exceeded: max !== null && value.knownTotal > max,
    });
  }
  return rows;
}
