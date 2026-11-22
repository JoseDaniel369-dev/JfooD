import { defaultDatabaseDirectory, importDatabaseFromAssetAsync, type SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/data/sqlite/repositories/settingsRepository';

import { CATALOG_FILE, CATALOG_SCHEMA } from './catalogSchema';
import { markCatalogAttached, markCatalogDetached } from './catalogState';
import { CATALOG_VERSION } from './catalogVersion';

/** `app_settings` key with the catalog version last copied out of the app package. */
export const CATALOG_INSTALLED_KEY = 'catalog_installed_version';

/** Why the catalog is unavailable (null when it is attached). Shown in Perfil → Acerca de. */
let unavailableReason: string | null = 'not-attached-yet';

export function getCatalogProblem(): string | null {
  return unavailableReason;
}

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Makes the bundled food catalog readable as `catalog.*` on this connection.
 *
 * 1. Copies catalog.db out of the app package into the database folder, when the
 *    copy there is not the bundled version yet (the catalog is read-only, so
 *    overwriting it can never lose anything of the person's).
 * 2. ATTACHes it and checks that it really has foods.
 *
 * Never throws: on any failure it returns false and the app carries on with the
 * person's own foods and the 338 built-in ones, as before the big catalog existed.
 */
export async function attachCatalog(database: SQLiteDatabase): Promise<boolean> {
  try {
    // `require` of a binary asset: Metro bundles it because Expo treats .db as an asset.
    const assetId = require('../../../assets/catalog/catalog.db') as number;

    const installed = await getSetting(database, CATALOG_INSTALLED_KEY);
    await importDatabaseFromAssetAsync(CATALOG_FILE, {
      assetId,
      forceOverwrite: installed !== String(CATALOG_VERSION),
    });

    if (defaultDatabaseDirectory == null) {
      throw new Error('No database directory.');
    }
    const path = `${String(defaultDatabaseDirectory).replace(/\/*$/, '')}/${CATALOG_FILE}`;

    // A connection that already has it attached (a second call) must not fail.
    const attachedNames = await database.getAllAsync<{ name: string }>('PRAGMA database_list');
    if (!attachedNames.some((entry) => entry.name === CATALOG_SCHEMA)) {
      await database.execAsync(`ATTACH DATABASE ${quoteSqlString(path)} AS ${CATALOG_SCHEMA}`);
    }

    const check = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${CATALOG_SCHEMA}.foods`,
    );
    if (!check || check.count === 0) {
      throw new Error('The catalog is empty.');
    }

    markCatalogAttached(database);
    unavailableReason = null;
    // Only now, with the catalog proven readable, is this version recorded as installed.
    if (installed !== String(CATALOG_VERSION)) {
      await setSetting(database, CATALOG_INSTALLED_KEY, String(CATALOG_VERSION));
    }
    return true;
  } catch (error) {
    markCatalogDetached(database);
    unavailableReason = error instanceof Error ? error.message : 'unknown';
    return false;
  }
}
