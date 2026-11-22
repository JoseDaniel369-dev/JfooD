import { foodInputNutrientsSchema, makeNutrients, type Nutrients } from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  NUTRIENT_ASSIGNMENTS,
  NUTRIENT_PLACEHOLDERS,
  nutrientColumnsSql,
  nutrientParams,
  nutrientsFromRow,
  type NutrientRow,
} from '@/data/sqlite/nutrientColumns';
import { describeNutrientsError } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { CATALOG_SCHEMA } from '@/data/catalog/catalogSchema';
import { isCatalogAttached } from '@/data/catalog/catalogState';
import {
  findCatalogByBarcode,
  getCatalogFoodById,
  getCatalogServings,
} from '@/data/sqlite/repositories/catalogRepository';
import { getServings, saveServing } from '@/data/sqlite/repositories/servingRepository';
import { containsPattern, escapeLike } from '@/data/sqlite/utils/like';
import { generateId } from '@/data/sqlite/utils/id';
import { normalizeName } from '@/features/foods/utils/normalize';
import { foodNutrients, type CreateFoodInput, type Food, type FoodSource } from '@/features/foods/types';

interface FoodRow extends NutrientRow {
  id: string;
  name: string;
  normalized_name: string;
  brand: string | null;
  barcode: string | null;
  source: string;
  external_id: string | null;
  is_favorite: number;
  cached_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_FOOD_COLUMNS = `
  id, name, normalized_name, brand, barcode, source, external_id,
  ${nutrientColumnsSql()},
  is_favorite, cached_at, created_at, updated_at
`;

type NutrientInput = {
  [Key in keyof Nutrients]?: number | null;
};

/** Validates the values typed by a person and returns them complete (unknown = null). */
function checkedNutrients(input: NutrientInput): Nutrients {
  const result = foodInputNutrientsSchema.safeParse(
    makeNutrients({
      caloriesKcal: input.caloriesKcal ?? null,
      proteinGrams: input.proteinGrams ?? null,
      carbohydrateGrams: input.carbohydrateGrams ?? null,
      fatGrams: input.fatGrams ?? null,
      fiberGrams: input.fiberGrams ?? null,
      sugarsGrams: input.sugarsGrams ?? null,
      saltGrams: input.saltGrams ?? null,
    }),
  );

  if (!result.success) {
    throw new Error(describeNutrientsError(result.error.issues));
  }
  return result.data;
}

export async function createFood(
  database: SQLiteDatabase,
  input: CreateFoodInput,
): Promise<Food> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('El nombre del alimento es obligatorio.');
  }
  const nutrients = checkedNutrients(input);

  const now = new Date().toISOString();
  const food: Food = {
    id: generateId(),
    name,
    normalizedName: normalizeName(name),
    brand: input.brand?.trim() ?? null,
    barcode: input.barcode ?? null,
    source: input.source ?? 'user',
    externalId: input.externalId ?? null,
    ...nutrients,
    isFavorite: false,
    cachedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await database.runAsync(
    `INSERT INTO foods (
      id, name, normalized_name, brand, barcode, source, external_id,
      ${nutrientColumnsSql()},
      is_favorite, cached_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ${NUTRIENT_PLACEHOLDERS}, ?, ?, ?, ?)`,
    [
      food.id,
      food.name,
      food.normalizedName,
      food.brand,
      food.barcode,
      food.source,
      food.externalId,
      ...nutrientParams(nutrients),
      food.isFavorite ? 1 : 0,
      food.cachedAt,
      food.createdAt,
      food.updatedAt,
    ],
  );

  return food;
}

export async function searchFoods(
  database: SQLiteDatabase,
  query: string,
  limit = 20,
): Promise<Food[]> {
  const normalized = normalizeName(query);
  // Every word must appear, in any order: "arroz pollo" finds "pollo con arroz".
  const tokens = normalized.split(' ').filter((token) => token !== '');
  const patterns = tokens.length > 0 ? tokens.map(containsPattern) : ['%%'];
  const where = patterns
    .map(() => `normalized_name LIKE ? ESCAPE '\\'`)
    .join(' AND ');

  if (isCatalogAttached(database)) {
    return searchLibraryAndCatalog(database, tokens, limit);
  }

  const rows = await database.getAllAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods
     WHERE ${where}
     ORDER BY is_favorite DESC,
              CASE WHEN normalized_name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
              name ASC
     LIMIT ?`,
    [...patterns, `${escapeLike(tokens[0] ?? '')}%`, limit],
  );

  return rows.map(mapFood);
}

/**
 * The person's foods and the bundled catalog in ONE ranked list. A food of the
 * library wins a tie with a catalog food; among catalog foods the most popular
 * (most scanned) and shortest name come first, so "yogur" shows plain yoghurts
 * from the common brands before a long-named variant.
 *
 * Ranking: favourites, then names that start with the first word, then names
 * with a word that starts with it, then the rest.
 */
async function searchLibraryAndCatalog(
  database: SQLiteDatabase,
  tokens: string[],
  limit: number,
): Promise<Food[]> {
  const first = escapeLike(tokens[0] ?? '');
  const patterns = tokens.length > 0 ? tokens.map(containsPattern) : ['%%'];
  const rank = (column: string) =>
    `CASE WHEN ${column} LIKE ? ESCAPE '\\' THEN 0
          WHEN (' ' || ${column}) LIKE ? ESCAPE '\\' THEN 1
          ELSE 2 END`;
  const rankParams = [`${first}%`, `% ${first}%`];

  const libraryWhere = patterns.map(() => `normalized_name LIKE ? ESCAPE '\\'`).join(' AND ');
  const catalogWhere = patterns.map(() => `c.search_text LIKE ? ESCAPE '\\'`).join(' AND ');

  const rows = await database.getAllAsync<FoodRow>(
    `SELECT * FROM (
       SELECT ${SELECT_FOOD_COLUMNS},
              is_favorite AS fav, 0 AS tier, 0 AS pop, ${rank('normalized_name')} AS rank
       FROM main.foods
       WHERE ${libraryWhere}
       UNION ALL
       SELECT c.id, c.name, c.normalized_name, c.brand, c.barcode, c.source, NULL AS external_id,
              ${nutrientColumnsSql('c')},
              0 AS is_favorite, NULL AS cached_at, '' AS created_at, '' AS updated_at,
              0 AS fav, 1 AS tier, c.popularity AS pop, ${rank('c.normalized_name')} AS rank
       FROM ${CATALOG_SCHEMA}.foods c
       WHERE ${catalogWhere}
         AND NOT EXISTS (SELECT 1 FROM main.foods m WHERE m.id = c.id)
     )
     ORDER BY fav DESC, rank ASC, tier ASC, pop DESC, LENGTH(name) ASC, name ASC
     LIMIT ?`,
    [...rankParams, ...patterns, ...rankParams, ...patterns, limit],
  );

  return rows.map(mapFood);
}

export async function getRecentFoods(
  database: SQLiteDatabase,
  limit = 10,
): Promise<Food[]> {
  const rows = await database.getAllAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods f
     INNER JOIN (
       SELECT food_id, MAX(created_at) AS last_used
       FROM (
         SELECT food_id, created_at FROM diary_entries WHERE food_id IS NOT NULL
         UNION ALL
         SELECT food_id, created_at FROM plan_entries WHERE food_id IS NOT NULL
       )
       GROUP BY food_id
     ) latest ON latest.food_id = f.id
     ORDER BY latest.last_used DESC
     LIMIT ?`,
    [limit],
  );

  return rows.map(mapFood);
}

/** Foods logged most often in the diary (ties broken by most recent use). */
export async function getFrequentFoods(
  database: SQLiteDatabase,
  limit = 10,
): Promise<Food[]> {
  const rows = await database.getAllAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods f
     INNER JOIN (
       SELECT food_id, COUNT(*) AS uses, MAX(created_at) AS last_used
       FROM diary_entries
       WHERE food_id IS NOT NULL
       GROUP BY food_id
     ) usage ON usage.food_id = f.id
     ORDER BY usage.uses DESC, usage.last_used DESC
     LIMIT ?`,
    [limit],
  );

  return rows.map(mapFood);
}

export async function getFavoriteFoods(
  database: SQLiteDatabase,
  limit = 20,
): Promise<Food[]> {
  const rows = await database.getAllAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods
     WHERE is_favorite = 1
     ORDER BY name ASC
     LIMIT ?`,
    [limit],
  );

  return rows.map(mapFood);
}

export async function toggleFavorite(
  database: SQLiteDatabase,
  foodId: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE foods
     SET is_favorite = ((is_favorite + 1) % 2),
         updated_at = ?
     WHERE id = ?`,
    [now, foodId],
  );

  const row = await database.getFirstAsync<{ is_favorite: number }>(
    'SELECT is_favorite FROM foods WHERE id = ?',
    [foodId],
  );

  return row?.is_favorite === 1;
}

/** The person's own food with this barcode (the barcode column is unique), or null. */
async function findLibraryFoodByBarcode(
  database: SQLiteDatabase,
  barcode: string,
): Promise<Food | null> {
  const row = await database.getFirstAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods
     WHERE barcode = ?`,
    [barcode],
  );

  return row ? mapFood(row) : null;
}

/** Food with this barcode: the person's own first, then the bundled catalog (works offline). */
export async function findFoodByBarcode(
  database: SQLiteDatabase,
  barcode: string,
): Promise<Food | null> {
  return (await findLibraryFoodByBarcode(database, barcode)) ?? (await findCatalogByBarcode(database, barcode));
}

/** Only the person's own library, never the catalog. */
async function getLibraryFoodById(database: SQLiteDatabase, foodId: string): Promise<Food | null> {
  const row = await database.getFirstAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods
     WHERE id = ?`,
    [foodId],
  );

  return row ? mapFood(row) : null;
}

/** A food by id: from the person's library, or else from the bundled catalog. */
export async function getFoodById(
  database: SQLiteDatabase,
  foodId: string,
): Promise<Food | null> {
  return (await getLibraryFoodById(database, foodId)) ?? (await getCatalogFoodById(database, foodId));
}

/**
 * Makes sure a food is in the person's library (`foods`), copying it, and its
 * portions, from the catalog the first time. Diary and plan entries, favourites
 * and recents all point at `foods`, so anything the person chooses goes through
 * here first. Idempotent: a food already in the library is returned as it is.
 */
export async function ensureFoodInLibrary(database: SQLiteDatabase, food: Food): Promise<Food> {
  const existing = await getLibraryFoodById(database, food.id);
  if (existing) {
    return existing;
  }

  const portions = await getCatalogServings(database, food.id);
  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    // INSERT OR IGNORE: if the person already has another food with this barcode the
    // unique index refuses the row, and that existing food is used below.
    await database.runAsync(
      `INSERT OR IGNORE INTO foods (
         id, name, normalized_name, brand, barcode, source, external_id,
         ${nutrientColumnsSql()},
         is_favorite, cached_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, ${NUTRIENT_PLACEHOLDERS}, 0, NULL, ?, ?)`,
      [
        food.id,
        food.name,
        food.normalizedName,
        food.brand,
        food.barcode,
        food.source,
        ...nutrientParams(foodNutrients(food)),
        now,
        now,
      ],
    );

    const inserted = await database.getFirstAsync<{ found: number }>(
      'SELECT 1 AS found FROM foods WHERE id = ?',
      [food.id],
    );
    if (inserted) {
      for (const [index, portion] of portions.entries()) {
        await database.runAsync(
          `INSERT OR IGNORE INTO food_servings (id, food_id, label, grams, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [`${food.id}-${index + 1}`, food.id, portion.label, portion.grams, now],
        );
      }
    }
  });

  return (
    (await getLibraryFoodById(database, food.id)) ??
    (food.barcode ? await findLibraryFoodByBarcode(database, food.barcode) : null) ??
    food
  );
}

export interface UpdateFoodInput extends NutrientInput {
  name: string;
  brand?: string | null;
}

export async function updateFood(
  database: SQLiteDatabase,
  foodId: string,
  input: UpdateFoodInput,
): Promise<Food | null> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('El nombre del alimento es obligatorio.');
  }
  const nutrients = checkedNutrients(input);

  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE foods
     SET name = ?,
         normalized_name = ?,
         brand = ?,
         ${NUTRIENT_ASSIGNMENTS},
         updated_at = ?
     WHERE id = ?`,
    [
      name,
      normalizeName(name),
      input.brand?.trim() || null,
      ...nutrientParams(nutrients),
      now,
      foodId,
    ],
  );

  return getFoodById(database, foodId);
}

const OWN_COPY_SUFFIX = ' (mío)';
const MAX_COPY_NAME_LENGTH = 80;

/**
 * Makes an editable copy of a food (typically one from the base catalog, which
 * cannot be edited): same values per 100 g and same portions, as the person's
 * own food. The original is never touched. Returns null when it does not exist.
 */
export async function duplicateFoodAsUser(
  database: SQLiteDatabase,
  foodId: string,
): Promise<Food | null> {
  const original = await getFoodById(database, foodId);
  if (!original) {
    return null;
  }

  const portions = await getServings(database, foodId);
  const name = `${original.name.slice(0, MAX_COPY_NAME_LENGTH - OWN_COPY_SUFFIX.length)}${OWN_COPY_SUFFIX}`;

  let copy: Food | null = null;
  // One transaction: the copy never exists without its portions.
  await database.withTransactionAsync(async () => {
    copy = await createFood(database, {
      name,
      brand: original.brand,
      source: 'user',
      caloriesKcal: original.caloriesKcal,
      proteinGrams: original.proteinGrams,
      carbohydrateGrams: original.carbohydrateGrams,
      fatGrams: original.fatGrams,
      fiberGrams: original.fiberGrams,
      sugarsGrams: original.sugarsGrams,
      saltGrams: original.saltGrams,
    });
    for (const portion of portions) {
      await saveServing(database, copy.id, portion.label, portion.grams);
    }
  });

  return copy;
}

export async function deleteFood(
  database: SQLiteDatabase,
  foodId: string,
): Promise<void> {
  await database.runAsync('DELETE FROM foods WHERE id = ?', [foodId]);
}

export async function getFoodUsageCount(
  database: SQLiteDatabase,
  foodId: string,
): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT
       (SELECT COUNT(*) FROM diary_entries WHERE food_id = ?) +
       (SELECT COUNT(*) FROM plan_entries WHERE food_id = ?) AS count`,
    [foodId, foodId],
  );

  return row?.count ?? 0;
}

function mapFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    brand: row.brand,
    barcode: row.barcode,
    source: row.source as FoodSource,
    externalId: row.external_id,
    ...nutrientsFromRow(row),
    isFavorite: row.is_favorite === 1,
    cachedAt: row.cached_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Foods by id, in the order of `ids` (unknown ids are skipped). */
export async function getFoodsByIds(
  database: SQLiteDatabase,
  ids: readonly string[],
): Promise<Food[]> {
  if (ids.length === 0) {
    return [];
  }

  // SQLite limits the number of variables, so long lists go in chunks.
  const CHUNK = 200;
  const found = new Map<string, Food>();

  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK);
    const rows = await database.getAllAsync<FoodRow>(
      `SELECT ${SELECT_FOOD_COLUMNS}
       FROM foods
       WHERE id IN (${chunk.map(() => '?').join(', ')})`,
      chunk,
    );
    for (const row of rows) {
      found.set(row.id, mapFood(row));
    }
  }

  return ids.flatMap((id) => {
    const food = found.get(id);
    return food ? [food] : [];
  });
}
