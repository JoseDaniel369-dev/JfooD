import type { SQLiteDatabase } from 'expo-sqlite';

import { attachCatalog } from '@/data/catalog/catalogDatabase';
import { seedCatalog } from '@/data/seed/seedCatalog';
import { migrateDatabase } from '@/data/sqlite/migrate';

/**
 * Runs when the database opens: brings the schema up to date, then makes sure
 * the base food catalog is loaded.
 */
export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await migrateDatabase(database);

  try {
    await seedCatalog(database);
  } catch {
    // The app works without the base catalog (the person can still create
    // foods), so a failed seed must never stop it from opening. Nothing was
    // committed, and the next launch tries again.
  }

  // The big read-only catalog (tens of thousands of foods with calories). If it
  // cannot be loaded the app works as before, with the person's foods and the
  // built-in ones; attachCatalog never throws.
  await attachCatalog(database);
}
