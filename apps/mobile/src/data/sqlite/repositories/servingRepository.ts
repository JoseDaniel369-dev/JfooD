import { gramsSchema } from '@jfood/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/data/sqlite/utils/id';

export interface Serving {
  id: string;
  foodId: string;
  label: string;
  grams: number;
}

interface ServingRow {
  id: string;
  food_id: string;
  label: string;
  grams: number;
}

export const MAX_SERVING_LABEL_LENGTH = 40;

export async function getServings(
  database: SQLiteDatabase,
  foodId: string,
): Promise<Serving[]> {
  const rows = await database.getAllAsync<ServingRow>(
    `SELECT id, food_id, label, grams
     FROM food_servings
     WHERE food_id = ?
     ORDER BY grams ASC, label ASC`,
    [foodId],
  );

  return rows.map((row) => ({
    id: row.id,
    foodId: row.food_id,
    label: row.label,
    grams: row.grams,
  }));
}

/** Adds (or replaces, by name) a portion of a food. */
export async function saveServing(
  database: SQLiteDatabase,
  foodId: string,
  label: string,
  grams: number,
): Promise<void> {
  const cleanLabel = label.trim().replace(/\s+/g, ' ');
  if (cleanLabel === '' || cleanLabel.length > MAX_SERVING_LABEL_LENGTH) {
    throw new Error(`El nombre de la ración debe tener entre 1 y ${MAX_SERVING_LABEL_LENGTH} caracteres.`);
  }

  const parsedGrams = gramsSchema.safeParse(grams);
  if (!parsedGrams.success) {
    throw new Error('Los gramos de la ración deben ser mayores que 0.');
  }

  await database.runAsync(
    `INSERT INTO food_servings (id, food_id, label, grams, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(food_id, label) DO UPDATE SET grams = excluded.grams`,
    [generateId(), foodId, cleanLabel, parsedGrams.data, new Date().toISOString()],
  );
}

export async function deleteServing(
  database: SQLiteDatabase,
  servingId: string,
): Promise<void> {
  await database.runAsync('DELETE FROM food_servings WHERE id = ?', [servingId]);
}
