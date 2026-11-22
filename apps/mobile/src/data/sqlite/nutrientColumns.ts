import { NUTRIENT_KEYS, type NutrientKey, type Nutrients } from '@jfood/core';

/**
 * The single place that knows how a nutrient maps to its SQL column. Every
 * query that reads or writes nutrients builds its column list from here, so
 * adding a nutrient can never leave one statement behind.
 */
export const NUTRIENT_COLUMN: Record<NutrientKey, string> = {
  caloriesKcal: 'calories_kcal',
  proteinGrams: 'protein_grams',
  carbohydrateGrams: 'carbohydrate_grams',
  fatGrams: 'fat_grams',
  fiberGrams: 'fiber_grams',
  sugarsGrams: 'sugars_grams',
  saltGrams: 'salt_grams',
};

export const NUTRIENT_COLUMNS: readonly string[] = NUTRIENT_KEYS.map(
  (key) => NUTRIENT_COLUMN[key],
);

/** `calories_kcal, protein_grams, …` (optionally qualified: `entry.calories_kcal, …`). */
export function nutrientColumnsSql(alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return NUTRIENT_COLUMNS.map((column) => `${prefix}${column}`).join(', ');
}

/** `?, ?, …` with one placeholder per nutrient. */
export const NUTRIENT_PLACEHOLDERS = NUTRIENT_COLUMNS.map(() => '?').join(', ');

/** `calories_kcal = ?, protein_grams = ?, …` for UPDATE statements. */
export const NUTRIENT_ASSIGNMENTS = NUTRIENT_COLUMNS.map(
  (column) => `${column} = ?`,
).join(', ');

/** Row shape of any table that stores nutrients. */
export interface NutrientRow {
  calories_kcal: number | null;
  protein_grams: number | null;
  carbohydrate_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  sugars_grams: number | null;
  salt_grams: number | null;
}

/** Values in the same order as `nutrientColumnsSql()`. */
export function nutrientParams(nutrients: Nutrients): (number | null)[] {
  return NUTRIENT_KEYS.map((key) => nutrients[key]);
}

/** Reads the nutrients of a row (a missing column counts as unknown). */
export function nutrientsFromRow(row: Partial<NutrientRow>): Nutrients {
  const nutrients = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    nutrients[key] = row[NUTRIENT_COLUMN[key] as keyof NutrientRow] ?? null;
  }
  return nutrients;
}
