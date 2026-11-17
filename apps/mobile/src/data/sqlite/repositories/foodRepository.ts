import { foodInputNutrientsSchema } from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { describeNutrientsError } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { generateId } from '@/data/sqlite/utils/id';
import { normalizeName } from '@/features/foods/utils/normalize';
import type { CreateFoodInput, Food, FoodSource } from '@/features/foods/types';

interface FoodRow {
  id: string;
  name: string;
  normalized_name: string;
  brand: string | null;
  barcode: string | null;
  source: string;
  external_id: string | null;
  calories_kcal: number | null;
  protein_grams: number | null;
  carbohydrate_grams: number | null;
  fat_grams: number | null;
  is_favorite: number;
  cached_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_FOOD_COLUMNS = `
  id, name, normalized_name, brand, barcode, source, external_id,
  calories_kcal, protein_grams, carbohydrate_grams, fat_grams,
  is_favorite, cached_at, created_at, updated_at
`;

function assertFoodNutrients(input: {
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
}): void {
  const result = foodInputNutrientsSchema.safeParse({
    caloriesKcal: input.caloriesKcal ?? null,
    proteinGrams: input.proteinGrams ?? null,
    carbohydrateGrams: input.carbohydrateGrams ?? null,
    fatGrams: input.fatGrams ?? null,
  });

  if (!result.success) {
    throw new Error(describeNutrientsError(result.error.issues));
  }
}

export async function createFood(
  database: SQLiteDatabase,
  input: CreateFoodInput,
): Promise<Food> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('El nombre del alimento es obligatorio.');
  }
  assertFoodNutrients(input);

  const now = new Date().toISOString();
  const food: Food = {
    id: generateId(),
    name,
    normalizedName: normalizeName(name),
    brand: input.brand?.trim() ?? null,
    barcode: input.barcode ?? null,
    source: input.source ?? 'user',
    externalId: input.externalId ?? null,
    caloriesKcal: input.caloriesKcal ?? null,
    proteinGrams: input.proteinGrams ?? null,
    carbohydrateGrams: input.carbohydrateGrams ?? null,
    fatGrams: input.fatGrams ?? null,
    isFavorite: false,
    cachedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await database.runAsync(
    `INSERT INTO foods (
      id, name, normalized_name, brand, barcode, source, external_id,
      calories_kcal, protein_grams, carbohydrate_grams, fat_grams,
      is_favorite, cached_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      food.id,
      food.name,
      food.normalizedName,
      food.brand,
      food.barcode,
      food.source,
      food.externalId,
      food.caloriesKcal,
      food.proteinGrams,
      food.carbohydrateGrams,
      food.fatGrams,
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

export interface UpdateFoodInput {
  name: string;
  brand?: string | null;
  caloriesKcal?: number | null;
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
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
  assertFoodNutrients(input);

  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE foods
     SET name = ?,
         normalized_name = ?,
         brand = ?,
         calories_kcal = ?,
         protein_grams = ?,
         carbohydrate_grams = ?,
         fat_grams = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      name,
      normalizeName(name),
      input.brand?.trim() || null,
      input.caloriesKcal ?? null,
      input.proteinGrams ?? null,
      input.carbohydrateGrams ?? null,
      input.fatGrams ?? null,
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
    caloriesKcal: row.calories_kcal,
    proteinGrams: row.protein_grams,
    carbohydrateGrams: row.carbohydrate_grams,
    fatGrams: row.fat_grams,
    isFavorite: row.is_favorite === 1,
    cachedAt: row.cached_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
