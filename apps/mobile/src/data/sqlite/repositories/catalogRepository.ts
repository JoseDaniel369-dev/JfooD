import type { SQLiteDatabase } from 'expo-sqlite';

import { CATALOG_SCHEMA, type CatalogFoodRow } from '@/data/catalog/catalogSchema';
import { isCatalogAttached } from '@/data/catalog/catalogState';
import { nutrientColumnsSql } from '@/data/sqlite/nutrientColumns';
import type { Food, FoodSource } from '@/features/foods/types';

/** Reads of the bundled catalog (`catalog.*`). Every function is a no-op when it is not attached. */

const C = CATALOG_SCHEMA;

type CatalogQueryRow = Omit<CatalogFoodRow, 'search_text' | 'category'> & {
  is_favorite?: number | null;
};

const CATALOG_COLUMNS = `c.id, c.name, c.normalized_name, c.brand, c.barcode, c.source, c.popularity,
  ${nutrientColumnsSql('c')}`;

/** A catalog row as a Food. It is not in the person's library until `ensureFoodInLibrary`. */
export function mapCatalogFood(row: CatalogQueryRow): Food {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    brand: row.brand,
    barcode: row.barcode,
    source: row.source as FoodSource,
    externalId: null,
    caloriesKcal: row.calories_kcal,
    proteinGrams: row.protein_grams,
    carbohydrateGrams: row.carbohydrate_grams,
    fatGrams: row.fat_grams,
    fiberGrams: row.fiber_grams,
    sugarsGrams: row.sugars_grams,
    saltGrams: row.salt_grams,
    isFavorite: row.is_favorite === 1,
    cachedAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

export async function getCatalogFoodById(
  database: SQLiteDatabase,
  foodId: string,
): Promise<Food | null> {
  if (!isCatalogAttached(database)) return null;

  const row = await database.getFirstAsync<CatalogQueryRow>(
    `SELECT ${CATALOG_COLUMNS} FROM ${C}.foods c WHERE c.id = ?`,
    [foodId],
  );
  return row ? mapCatalogFood(row) : null;
}

export async function findCatalogByBarcode(
  database: SQLiteDatabase,
  barcode: string,
): Promise<Food | null> {
  if (!isCatalogAttached(database)) return null;

  const row = await database.getFirstAsync<CatalogQueryRow>(
    `SELECT ${CATALOG_COLUMNS} FROM ${C}.foods c WHERE c.barcode = ? ORDER BY c.popularity DESC LIMIT 1`,
    [barcode],
  );
  return row ? mapCatalogFood(row) : null;
}

/** The most popular catalog food whose normalized name is exactly this, or null. */
export async function findCatalogByExactName(
  database: SQLiteDatabase,
  normalizedName: string,
): Promise<Food | null> {
  if (!isCatalogAttached(database)) return null;

  const row = await database.getFirstAsync<CatalogQueryRow>(
    `SELECT ${CATALOG_COLUMNS} FROM ${C}.foods c
     WHERE c.normalized_name = ?
     ORDER BY c.popularity DESC, LENGTH(c.name) ASC, c.id ASC
     LIMIT 1`,
    [normalizedName],
  );
  return row ? mapCatalogFood(row) : null;
}

export interface CatalogCategory {
  name: string;
  count: number;
}

/** The catalog's categories, biggest first. */
export async function getCatalogCategories(database: SQLiteDatabase): Promise<CatalogCategory[]> {
  if (!isCatalogAttached(database)) return [];

  return database.getAllAsync<CatalogCategory>(
    `SELECT category AS name, COUNT(*) AS count
     FROM ${C}.foods
     GROUP BY category
     ORDER BY count DESC, category ASC`,
  );
}

/**
 * One page of a category, most popular first. A food the person already has in
 * their library comes back with their own favourite mark.
 */
export async function getCatalogByCategory(
  database: SQLiteDatabase,
  category: string,
  limit: number,
  offset: number,
): Promise<Food[]> {
  if (!isCatalogAttached(database)) return [];

  const rows = await database.getAllAsync<CatalogQueryRow>(
    `SELECT ${CATALOG_COLUMNS}, COALESCE(m.is_favorite, 0) AS is_favorite
     FROM ${C}.foods c
     LEFT JOIN main.foods m ON m.id = c.id
     WHERE c.category = ?
     ORDER BY c.popularity DESC, LENGTH(c.name) ASC, c.name ASC, c.id ASC
     LIMIT ? OFFSET ?`,
    [category, limit, offset],
  );
  return rows.map(mapCatalogFood);
}

export async function countCatalog(database: SQLiteDatabase): Promise<number> {
  if (!isCatalogAttached(database)) return 0;

  const row = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${C}.foods`);
  return row?.count ?? 0;
}

/** Portions of a catalog food, smallest first. */
export async function getCatalogServings(
  database: SQLiteDatabase,
  foodId: string,
): Promise<{ label: string; grams: number }[]> {
  if (!isCatalogAttached(database)) return [];

  return database.getAllAsync<{ label: string; grams: number }>(
    `SELECT label, grams FROM ${C}.servings WHERE food_id = ? ORDER BY grams ASC, label ASC`,
    [foodId],
  );
}
