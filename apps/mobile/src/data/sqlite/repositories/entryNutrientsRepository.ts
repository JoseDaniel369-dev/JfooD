import { foodInputNutrientsSchema, type Nutrients } from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

export type EntryTable = 'diary_entries' | 'plan_entries';

export interface CompleteEntryOptions {
  /** Also store the values in the user's catalog food so new entries are right. */
  alsoUpdateFood?: boolean;
}

/**
 * First custom (Spanish) validation message of typed nutrition values, or a
 * generic one. Zod's default messages are English and not shown to people.
 */
export function describeNutrientsError(
  issues: readonly { code: string; message: string }[],
): string {
  const custom = issues.find((issue) => issue.code === 'custom');
  return custom?.message ?? 'Revisa los valores nutricionales (deben ser 0 o mayores).';
}

/**
 * Replaces the nutrients-per-100 g snapshot of ONE entry (diary or plan).
 * Used to complete entries that were saved without nutritional data. Other
 * entries and past totals are never touched implicitly.
 */
export async function updateEntryNutrients(
  database: SQLiteDatabase,
  table: EntryTable,
  entryId: string,
  per100g: Nutrients,
  options: CompleteEntryOptions = {},
): Promise<void> {
  const parsed = foodInputNutrientsSchema.safeParse(per100g);
  if (!parsed.success) {
    throw new Error(describeNutrientsError(parsed.error.issues));
  }

  const values = parsed.data;
  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    const entry = await database.getFirstAsync<{ food_id: string | null }>(
      `SELECT food_id FROM ${table} WHERE id = ?`,
      [entryId],
    );

    if (!entry) {
      throw new Error('Entrada no encontrada.');
    }

    await database.runAsync(
      `UPDATE ${table}
       SET calories_kcal = ?, protein_grams = ?, carbohydrate_grams = ?,
           fat_grams = ?, updated_at = ?
       WHERE id = ?`,
      [
        values.caloriesKcal,
        values.proteinGrams,
        values.carbohydrateGrams,
        values.fatGrams,
        now,
        entryId,
      ],
    );

    if (options.alsoUpdateFood && entry.food_id) {
      await database.runAsync(
        `UPDATE foods
         SET calories_kcal = ?, protein_grams = ?, carbohydrate_grams = ?,
             fat_grams = ?, updated_at = ?
         WHERE id = ? AND source IN ('user', 'open_food_facts')`,
        [
          values.caloriesKcal,
          values.proteinGrams,
          values.carbohydrateGrams,
          values.fatGrams,
          now,
          entry.food_id,
        ],
      );
    }
  });
}
