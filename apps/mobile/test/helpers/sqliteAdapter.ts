import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '../../src/data/sqlite/migrate';

type Params = unknown[];

function normalizeParams(params: unknown[]): Params {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as Params;
  }
  return params;
}

/**
 * Minimal in-memory implementation of the subset of the expo-sqlite
 * `SQLiteDatabase` API used by the repositories, backed by `node:sqlite`.
 * It lets repository tests run the real migrations and the real SQL.
 */
export class TestDatabase {
  readonly raw: DatabaseSync;
  private transactionDepth = 0;

  constructor() {
    this.raw = new DatabaseSync(':memory:');
  }

  async execAsync(sql: string): Promise<void> {
    this.raw.exec(sql);
  }

  async runAsync(
    sql: string,
    ...params: unknown[]
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.raw.prepare(sql).run(...(normalizeParams(params) as never[]));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const rows = this.raw
      .prepare(sql)
      .all(...(normalizeParams(params) as never[]));
    return rows.map((row) => ({ ...row })) as T[];
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const row = this.raw
      .prepare(sql)
      .get(...(normalizeParams(params) as never[]));
    return (row ? { ...row } : null) as T | null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    if (this.transactionDepth > 0) {
      throw new Error('Nested transactions are not supported by the test adapter.');
    }
    this.raw.exec('BEGIN');
    this.transactionDepth += 1;
    try {
      await task();
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  /**
   * expo-sqlite runs an exclusive transaction on a NEW connection, where
   * `PRAGMA foreign_keys` is off (and cannot be switched on inside a
   * transaction). The adapter reproduces that so the tests catch code that
   * silently relies on foreign keys being enforced there.
   */
  async withExclusiveTransactionAsync(
    task: (transaction: TestDatabase) => Promise<void>,
  ): Promise<void> {
    this.raw.exec('PRAGMA foreign_keys = OFF');
    try {
      await this.withTransactionAsync(() => task(this));
    } finally {
      this.raw.exec('PRAGMA foreign_keys = ON');
    }
  }

  close(): void {
    this.raw.close();
  }

  asSqlite(): SQLiteDatabase {
    return this as unknown as SQLiteDatabase;
  }
}

/** Creates an in-memory database with all real migrations applied. */
export async function createMigratedDatabase(): Promise<TestDatabase> {
  const db = new TestDatabase();
  await migrateDatabase(db.asSqlite());
  return db;
}
