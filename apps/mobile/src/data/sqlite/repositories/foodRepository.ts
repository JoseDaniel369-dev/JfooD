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
import { generateId } from '@/data/sqlite/utils/id';
import { normalizeName } from '@/features/foods/utils/normalize';
import type { CreateFoodInput, Food, FoodSource } from '@/features/foods/types';

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

function containsPattern(token: string): string {
  return `%${escapeLike(token)}%`;
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
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

/** Local food with this barcode (the barcode column is unique), or null. */
export async function findFoodByBarcode(
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

export async function getFoodById(
  database: SQLiteDatabase,
  foodId: string,
): Promise<Food | null> {
  const row = await database.getFirstAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods
     WHERE id = ?`,
    [foodId],
  );

  return row ? mapFood(row) : null;
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
