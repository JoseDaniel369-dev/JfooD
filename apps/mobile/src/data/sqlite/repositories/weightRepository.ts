import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/data/sqlite/utils/id';
import { assertLocalDate, toLocalDate } from '@/features/diary/utils/date';

export interface WeightLog {
  localDate: string;
  weightKg: number;
  note: string | null;
  createdAt: string;
}

export interface UpsertWeightLogInput {
  localDate: string;
  weightKg: number;
  note?: string | null;
}

interface WeightLogRow {
  local_date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
}

export async function getWeightLogs(
  database: SQLiteDatabase,
  limit = 100,
): Promise<WeightLog[]> {
  const rows = await database.getAllAsync<WeightLogRow>(
    `SELECT local_date, weight_kg, note, created_at
     FROM weight_logs
     ORDER BY local_date DESC, created_at DESC
     LIMIT ?`,
    [limit],
  );

  return rows.map(mapWeightLog);
}

export async function upsertWeightLog(
  database: SQLiteDatabase,
  input: UpsertWeightLogInput,
): Promise<void> {
  assertLocalDate(input.localDate);
  if (input.localDate > toLocalDate(new Date())) {
    throw new Error('No se puede registrar el peso de una fecha futura.');
  }

  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new Error('El peso debe ser un número mayor que 0.');
  }

  if (input.weightKg > 300) {
    throw new Error('El peso no puede superar los 300 kg.');
  }

  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO weight_logs (id, local_date, weight_kg, note, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(local_date) DO UPDATE SET
       weight_kg = excluded.weight_kg,
       note = excluded.note`,
    [generateId(), input.localDate, input.weightKg, input.note ?? null, now],
  );
}

export async function deleteWeightLog(
  database: SQLiteDatabase,
  localDate: string,
): Promise<void> {
  await database.runAsync('DELETE FROM weight_logs WHERE local_date = ?', [
    localDate,
  ]);
}

function mapWeightLog(row: WeightLogRow): WeightLog {
  return {
    localDate: row.local_date,
    weightKg: row.weight_kg,
    note: row.note,
    createdAt: row.created_at,
  };
}
