import type { SQLiteDatabase } from 'expo-sqlite';

import { initialMigration } from './migrations/001_initial';
import { planMigration } from './migrations/002_plan';
import { settingsMigration } from './migrations/003_settings';
import { waterMigration } from './migrations/004_water';

const migrations = [
  { version: 1, sql: initialMigration },
  { version: 2, sql: planMigration },
  { version: 3, sql: settingsMigration },
  { version: 4, sql: waterMigration },
] as const;

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = result?.user_version ?? 0;

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
