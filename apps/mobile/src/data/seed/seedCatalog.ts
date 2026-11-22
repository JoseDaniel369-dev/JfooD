import type { SQLiteDatabase } from 'expo-sqlite';

import {
  NUTRIENT_PLACEHOLDERS,
  nutrientColumnsSql,
} from '@/data/sqlite/nutrientColumns';
import { getSetting, setSetting } from '@/data/sqlite/repositories/settingsRepository';
import { normalizeName } from '@/features/foods/utils/normalize';

import seedFoods from './foods.json';

/**
 * Version of the bundled catalog. Raise it when foods.json changes: the next
 * launch refreshes the catalog foods (and only those) in every install.
 */
export const SEED_VERSION = 1;
export const SEED_VERSION_KEY = 'seed_version';

export interface SeedFood {
  id: string;
  name: string;
  category: string;
  source: 'usda' | 'reference';
  caloriesKcal: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarsGrams: number | null;
  saltGrams: number | null;
  servings: { label: string; grams: number }[];
}

export const SEED_CATALOG = seedFoods as SeedFood[];

/**
 * Loads the base catalog (common foods per 100 g, with typical portions) into
 * the foods table, marked `source = 'seed'`.
 *
 * Safe to run on every launch: it does nothing when the catalog is already at
 * this version, so catalog foods the person deleted stay deleted. Foods created
 * by the person (`user`, `open_food_facts`) are never touched: only rows with
 * the catalog's own ids are inserted or refreshed.
 *
 * `force` loads it regardless of the stored version. It is used after restoring
 * a backup that replaced the foods table with one that has no catalog.
 */
export async function seedCatalog(
  database: SQLiteDatabase,
  options: { force?: boolean } = {},
): Promise<boolean> {
  const version = await getSetting(database, SEED_VERSION_KEY);

  if (!options.force && version === String(SEED_VERSION)) {
    return false;
  }

  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    for (const food of SEED_CATALOG) {
      await database.runAsync(
        `INSERT INTO foods (
           id, name, normalized_name, brand, barcode, source, external_id,
           ${nutrientColumnsSql()},
           is_favorite, cached_at, created_at, updated_at
         ) VALUES (?, ?, ?, NULL, NULL, 'seed', NULL, ${NUTRIENT_PLACEHOLDERS}, 0, NULL, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           normalized_name = excluded.normalized_name,
           calories_kcal = excluded.calories_kcal,
           protein_grams = excluded.protein_grams,
           carbohydrate_grams = excluded.carbohydrate_grams,
           fat_grams = excluded.fat_grams,
           fiber_grams = excluded.fiber_grams,
           sugars_grams = excluded.sugars_grams,
           salt_grams = excluded.salt_grams,
           updated_at = excluded.updated_at
         WHERE foods.source = 'seed'`,
        [
          food.id,
          food.name,
          normalizeName(food.name),
          food.caloriesKcal,
          food.proteinGrams,
          food.carbohydrateGrams,
          food.fatGrams,
          food.fiberGrams,
          food.sugarsGrams,
          food.saltGrams,
          now,
          now,
        ],
      );

      for (const [index, serving] of food.servings.entries()) {
        // Never overwrite: the person may have changed or removed a portion.
        await database.runAsync(
          `INSERT OR IGNORE INTO food_servings (id, food_id, label, grams, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [`${food.id}-${index + 1}`, food.id, serving.label, serving.grams, now],
        );
      }
    }

    await setSetting(database, SEED_VERSION_KEY, String(SEED_VERSION));
  });

  return true;
}
