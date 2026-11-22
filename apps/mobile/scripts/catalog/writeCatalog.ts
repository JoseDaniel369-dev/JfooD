/**
 * Writes the catalog file (assets/catalog/catalog.db) and the small TypeScript
 * file the app reads its version and counts from.
 *
 * Used by the catalog build scripts and by the tests, so both produce exactly
 * what the app expects. Run with tsx (it imports the app's own TypeScript).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { foodInputNutrientsSchema, makeNutrients } from '@jfood/core';

import {
  catalogSchemaSql,
  type CatalogFoodRow,
  type CatalogSource,
} from '../../src/data/catalog/catalogSchema';
import { normalizeName } from '../../src/features/foods/utils/normalize';

/** A food as the build scripts produce it, before it becomes a catalog row. */
export interface CatalogInput {
  id: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  category: string;
  source: CatalogSource;
  popularity?: number;
  caloriesKcal: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarsGrams: number | null;
  saltGrams: number | null;
  servings?: { label: string; grams: number }[];
}

export interface CatalogMeta {
  /** Bumped by every rebuild: the app copies the new file out of its package when it changes. */
  version: number;
  /** Free text per source for the credits screen, e.g. { usda: 6900, off: 28000 }. */
  counts: Record<string, number>;
  builtAt: string;
}

/** The row a food becomes. Throws on anything the schema or the app's rules refuse. */
export function toCatalogRow(food: CatalogInput): CatalogFoodRow {
  const name = food.name.trim();
  if (name.length < 2) {
    throw new Error(`${food.id}: nombre vacío`);
  }
  const normalized = normalizeName(name);
  const brand = food.brand?.trim() || null;

  // The same validation a food typed by a person goes through: an impossible
  // value fails the build instead of reaching a phone.
  const checked = foodInputNutrientsSchema.safeParse(
    makeNutrients({
      caloriesKcal: food.caloriesKcal,
      proteinGrams: food.proteinGrams,
      carbohydrateGrams: food.carbohydrateGrams,
      fatGrams: food.fatGrams,
      fiberGrams: food.fiberGrams,
      sugarsGrams: food.sugarsGrams,
      saltGrams: food.saltGrams,
    }),
  );
  if (!checked.success) {
    throw new Error(`${food.id} (${name}): ${checked.error.issues.map((i) => i.message).join('; ')}`);
  }
  const n = checked.data;
  if (n.caloriesKcal === null) {
    throw new Error(`${food.id} (${name}): sin calorías`);
  }

  return {
    id: food.id,
    name,
    normalized_name: normalized,
    search_text: brand ? `${normalized} ${normalizeName(brand)}` : normalized,
    brand,
    barcode: food.barcode ?? null,
    category: food.category,
    source: food.source,
    popularity: Math.max(0, Math.round(food.popularity ?? 0)),
    calories_kcal: n.caloriesKcal,
    protein_grams: n.proteinGrams,
    carbohydrate_grams: n.carbohydrateGrams,
    fat_grams: n.fatGrams,
    fiber_grams: n.fiberGrams,
    sugars_grams: n.sugarsGrams,
    salt_grams: n.saltGrams,
  };
}

/**
 * Builds the catalog file from `foods`. Duplicated ids fail the build; the
 * caller is responsible for deduplicating names.
 */
export function writeCatalog(foods: readonly CatalogInput[], path: string, meta: CatalogMeta): void {
  mkdirSync(dirname(path), { recursive: true });
  rmSync(path, { force: true });

  const database = new DatabaseSync(path);
  try {
    database.exec('PRAGMA journal_mode = DELETE');
    database.exec(catalogSchemaSql());

    const insertFood = database.prepare(
      `INSERT INTO foods (id, name, normalized_name, search_text, brand, barcode, category, source, popularity,
         calories_kcal, protein_grams, carbohydrate_grams, fat_grams, fiber_grams, sugars_grams, salt_grams)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertServing = database.prepare('INSERT INTO servings (food_id, label, grams) VALUES (?, ?, ?)');

    database.exec('BEGIN');
    for (const food of foods) {
      const row = toCatalogRow(food);
      insertFood.run(
        row.id, row.name, row.normalized_name, row.search_text, row.brand, row.barcode, row.category,
        row.source, row.popularity, row.calories_kcal, row.protein_grams, row.carbohydrate_grams,
        row.fat_grams, row.fiber_grams, row.sugars_grams, row.salt_grams,
      );
      const seen = new Set<string>();
      for (const serving of food.servings ?? []) {
        const label = serving.label.trim();
        if (label === '' || seen.has(label) || !(serving.grams > 0) || serving.grams > 5000) continue;
        seen.add(label);
        insertServing.run(row.id, label, serving.grams);
      }
    }

    const putMeta = database.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    putMeta.run('version', String(meta.version));
    putMeta.run('built_at', meta.builtAt);
    putMeta.run('counts', JSON.stringify(meta.counts));
    database.exec('COMMIT');

    database.exec(`PRAGMA user_version = ${Math.trunc(meta.version)}`);
    database.exec('ANALYZE');
    database.exec('VACUUM');
  } finally {
    database.close();
  }
}

/** Writes src/data/catalog/catalogVersion.ts, the constants the app imports. */
export function writeCatalogVersionFile(path: string, meta: CatalogMeta): void {
  writeFileSync(
    path,
    `// Generated by scripts/catalog (do not edit by hand).
/** Changes with every rebuild of assets/catalog/catalog.db: the app re-copies the file when it differs. */
export const CATALOG_VERSION = ${meta.version};

/** Foods per source, for the credits screen. */
export const CATALOG_COUNTS = ${JSON.stringify(meta.counts)} as const;

export const CATALOG_BUILT_AT = '${meta.builtAt}';
`,
  );
}
