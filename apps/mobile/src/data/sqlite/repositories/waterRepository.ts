import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/data/sqlite/utils/id';
import { assertLocalDate } from '@/features/diary/utils/date';

/** Largest amount of a single water log (a big bottle is about 1.5 l). */
export const MAX_WATER_LOG_ML = 5000;

export interface WaterLog {
  id: string;
  amountMl: number;
  createdAt: string;
}

export interface WaterDay {
  localDate: string;
  totalMl: number;
  logs: WaterLog[];
}

interface WaterLogRow {
  id: string;
  amount_ml: number;
  created_at: string;
}

export async function addWater(
  database: SQLiteDatabase,
  localDate: string,
  amountMl: number,
): Promise<void> {
  assertLocalDate(localDate);
  if (!Number.isFinite(amountMl) || amountMl <= 0) {
    throw new Error('La cantidad de agua debe ser mayor que 0.');
  }
  if (amountMl > MAX_WATER_LOG_ML) {
    throw new Error(`Cada registro de agua puede ser de hasta ${MAX_WATER_LOG_ML} ml.`);
  }

  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO water_logs (id, local_date, amount_ml, created_at)
     VALUES (?, ?, ?, ?)`,
    [generateId(), localDate, Math.round(amountMl), now],
  );
}

export async function getWaterDay(
  database: SQLiteDatabase,
  localDate: string,
): Promise<WaterDay> {
  const rows = await database.getAllAsync<WaterLogRow>(
    `SELECT id, amount_ml, created_at
     FROM water_logs
     WHERE local_date = ?
     ORDER BY created_at DESC, id DESC`,
    localDate,
  );

  const logs = rows.map((row) => ({
    id: row.id,
    amountMl: row.amount_ml,
    createdAt: row.created_at,
  }));

  return {
    localDate,
    totalMl: logs.reduce((sum, log) => sum + log.amountMl, 0),
    logs,
  };
}

export async function deleteWaterLog(
  database: SQLiteDatabase,
  logId: string,
): Promise<void> {
  await database.runAsync('DELETE FROM water_logs WHERE id = ?', [logId]);
}
