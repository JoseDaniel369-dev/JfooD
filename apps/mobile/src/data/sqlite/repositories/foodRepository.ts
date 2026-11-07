import type { SQLiteDatabase } from 'expo-sqlite';

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

export async function createFood(
  database: SQLiteDatabase,
  input: CreateFoodInput,
): Promise<Food> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('El nombre del alimento es obligatorio.');
  }

  const now = new Date().toISOString();
  const food: Food = {
    id: generateId(),
    name,
    normalizedName: normalizeName(name),
    brand: input.brand?.trim() ?? null,
    barcode: null,
    source: 'user',
    externalId: null,
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
  const pattern = `%${escapeLike(normalized)}%`;

  const rows = await database.getAllAsync<FoodRow>(
    `SELECT ${SELECT_FOOD_COLUMNS}
     FROM foods
     WHERE normalized_name LIKE ? ESCAPE '\\'
     ORDER BY is_favorite DESC, name ASC
     LIMIT ?`,
    [pattern, limit],
  );

  return rows.map(mapFood);
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function getRecentFoods(
  database: SQLiteDatabase,
  limit = 10,
): Promise<Food[]> {
  const rows = await database.getAllAsync<FoodRow>(
    `SELECT f.*, MAX(latest.last_used) AS last_used
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
     GROUP BY f.id
     ORDER BY last_used DESC
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
