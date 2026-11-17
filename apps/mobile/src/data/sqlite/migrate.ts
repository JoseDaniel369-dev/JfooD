import type { SQLiteDatabase } from 'expo-sqlite';

import { initialMigration } from './migrations/001_initial';
import { planMigration } from './migrations/002_plan';
import { settingsMigration } from './migrations/003_settings';
import { waterMigration } from './migrations/004_water';
import { goalMigration } from './migrations/005_goal';

const migrations = [
  { version: 1, sql: initialMigration },
  { version: 2, sql: planMigration },
  { version: 3, sql: settingsMigration },
  { version: 4, sql: waterMigration },
  { version: 5, sql: goalMigration },
] as const;

/** Schema version produced by the last migration. */
export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0;

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = result?.user_version ?? 0;
  const latestVersion = LATEST_SCHEMA_VERSION;

  if (currentVersion > latestVersion) {
    // An older build opened a database created by a newer one. Running on it
    // could corrupt data the older code does not understand, so stop here.
    throw new Error(
      `La base de datos (v${currentVersion}) es más nueva que esta versión de la app (v${latestVersion}). Actualiza JfooD.`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await database.withTransactionAsync(async () => {
      await database.execAsync(migration.sql);
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
