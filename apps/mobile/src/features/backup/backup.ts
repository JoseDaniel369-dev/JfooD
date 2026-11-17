import type { SQLiteDatabase } from 'expo-sqlite';

export const BACKUP_FORMAT = 'jfood-backup';
/** Version of this file format (not of the SQLite schema). */
export const BACKUP_VERSION = 1;

type Cell = string | number | null;
export type BackupRow = Record<string, Cell>;

/**
 * Tables of user data, in an order that satisfies foreign keys when inserting
 * (parents first). Columns are a whitelist: nothing else is ever read from a
 * backup file or interpolated into SQL.
 */
export const BACKUP_TABLES = {
  foods: [
    'id', 'name', 'normalized_name', 'brand', 'barcode', 'source', 'external_id',
    'calories_kcal', 'protein_grams', 'carbohydrate_grams', 'fat_grams',
    'is_favorite', 'cached_at', 'created_at', 'updated_at',
  ],
  diary_meals: ['id', 'local_date', 'meal_type', 'created_at'],
  diary_entries: [
    'id', 'meal_id', 'food_id', 'food_name', 'grams', 'calories_kcal',
    'protein_grams', 'carbohydrate_grams', 'fat_grams', 'created_at', 'updated_at',
  ],
  plan_entries: [
    'id', 'local_date', 'meal_type', 'food_id', 'food_name', 'grams',
    'calories_kcal', 'protein_grams', 'carbohydrate_grams', 'fat_grams',
    'created_at', 'updated_at',
  ],
  user_profile: [
    'id', 'height_cm', 'birth_date', 'mifflin_variant', 'activity_level',
    'goal_type', 'weekly_rate_kg', 'updated_at',
  ],
  nutrition_goals: [
    'id', 'effective_from', 'calories_kcal', 'protein_grams',
    'carbohydrate_grams', 'fat_grams', 'created_at',
  ],
  weight_logs: ['id', 'local_date', 'weight_kg', 'note', 'created_at'],
  water_logs: ['id', 'local_date', 'amount_ml', 'created_at'],
  app_settings: ['key', 'value'],
} as const satisfies Record<string, readonly string[]>;

export type BackupTable = keyof typeof BACKUP_TABLES;
const TABLE_NAMES = Object.keys(BACKUP_TABLES) as BackupTable[];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** SQLite schema version (PRAGMA user_version) the data comes from. */
  schemaVersion: number;
  createdAt: string;
  tables: Partial<Record<BackupTable, BackupRow[]>>;
}

export type BackupCounts = Record<BackupTable, number>;

export class BackupError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Reads every user table into a plain, JSON-serialisable object. */
export async function exportBackup(
  database: SQLiteDatabase,
  now: Date = new Date(),
): Promise<BackupFile> {
  const version = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const tables: BackupFile['tables'] = {};

  for (const table of TABLE_NAMES) {
    const columns = BACKUP_TABLES[table].join(', ');
    tables[table] = await database.getAllAsync<BackupRow>(
      `SELECT ${columns} FROM ${table} ORDER BY rowid`,
    );
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: version?.user_version ?? 0,
    createdAt: now.toISOString(),
    tables,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Structural validation of untrusted JSON. Value ranges and relations are
 * enforced by the database constraints when the data is restored inside a
 * transaction, so an invalid file can never leave partial data behind.
 */
export function parseBackup(value: unknown, latestSchemaVersion: number): BackupFile {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT) {
    throw new BackupError('El archivo no es una copia de seguridad de JfooD.');
  }
  if (typeof value.version !== 'number' || value.version > BACKUP_VERSION) {
    throw new BackupError(
      'La copia es de una versión más nueva de JfooD. Actualiza la app para restaurarla.',
    );
  }
  if (
    typeof value.schemaVersion !== 'number' ||
    value.schemaVersion > latestSchemaVersion
  ) {
    throw new BackupError(
      'La copia procede de una base de datos más nueva que esta versión de la app.',
    );
  }
  if (!isRecord(value.tables)) {
    throw new BackupError('La copia no contiene datos.');
  }

  const tables: BackupFile['tables'] = {};

  for (const [name, rows] of Object.entries(value.tables)) {
    if (!(name in BACKUP_TABLES)) {
      throw new BackupError(`La copia contiene una tabla desconocida: ${name}.`);
    }
    const table = name as BackupTable;
    const allowed = new Set<string>(BACKUP_TABLES[table]);

    if (!Array.isArray(rows)) {
      throw new BackupError(`Datos no válidos en ${name}.`);
    }

    tables[table] = rows.map((row, index) => {
      if (!isRecord(row)) {
        throw new BackupError(`Fila ${index + 1} no válida en ${name}.`);
      }
      const clean: BackupRow = {};
      for (const [column, cell] of Object.entries(row)) {
        if (!allowed.has(column)) {
          throw new BackupError(`Columna desconocida ${name}.${column}.`);
        }
        if (cell !== null && typeof cell !== 'string' && typeof cell !== 'number') {
          throw new BackupError(`Valor no válido en ${name}.${column}.`);
        }
        if (typeof cell === 'number' && !Number.isFinite(cell)) {
          throw new BackupError(`Número no válido en ${name}.${column}.`);
        }
        clean[column] = cell;
      }
      return clean;
    });
  }

  return {
    format: BACKUP_FORMAT,
    version: value.version,
    schemaVersion: value.schemaVersion,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    tables,
  };
}

const DELETE_ORDER: BackupTable[] = [
  'diary_entries',
  'diary_meals',
  'plan_entries',
  'water_logs',
  'weight_logs',
  'nutrition_goals',
  'user_profile',
  'app_settings',
  'foods',
];

/**
 * Replaces ALL user data with the backup, atomically: if anything fails (bad
 * value, broken reference) the transaction rolls back and nothing changes.
 */
export async function restoreBackup(
  database: SQLiteDatabase,
  backup: BackupFile,
): Promise<BackupCounts> {
  const counts = Object.fromEntries(TABLE_NAMES.map((t) => [t, 0])) as BackupCounts;

  try {
    await database.withTransactionAsync(async () => {
      for (const table of DELETE_ORDER) {
        await database.runAsync(`DELETE FROM ${table}`);
      }

      for (const table of TABLE_NAMES) {
        for (const row of backup.tables[table] ?? []) {
          // Only the columns present in the file: backups made before a column
          // existed fall back to that column's default.
          const columns = BACKUP_TABLES[table].filter(
            (column) => row[column] !== undefined,
          );
          const placeholders = columns.map(() => '?').join(', ');

          await database.runAsync(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            columns.map((column) => row[column] ?? null),
          );
          counts[table] += 1;
        }
      }
    });
  } catch (error) {
    throw new BackupError(
      'No se ha podido restaurar la copia: contiene datos no válidos. No se ha cambiado nada.',
      error,
    );
  }

  return counts;
}
