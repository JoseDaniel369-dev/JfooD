import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { LATEST_SCHEMA_VERSION } from '@/data/sqlite/migrate';
import {
  BackupError,
  exportBackup,
  parseBackup,
  type BackupFile,
} from '@/features/backup/backup';
import { toLocalDate } from '@/features/diary/utils/date';

/** Writes the backup to a temporary JSON file and opens the system share sheet. */
export async function shareBackup(database: SQLiteDatabase): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new BackupError('Este dispositivo no permite compartir archivos.');
  }

  await cleanStaleBackups();

  const backup = await exportBackup(database);
  const uri = `${FileSystem.cacheDirectory}${BACKUP_FILE_PREFIX}${toLocalDate(new Date())}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup));

  // The file is NOT deleted here: on Android `shareAsync` returns when the chooser
  // closes, before the receiving app (Gmail, Drive…) has read it. It is removed
  // by `cleanStaleBackups` the next time the app starts or a backup is made.
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Guardar copia de seguridad de JfooD',
    UTI: 'public.json',
  });
}

const BACKUP_FILE_PREFIX = 'jfood-copia-';

/** Removes backup files left in the cache by earlier exports (they hold health data). */
export async function cleanStaleBackups(): Promise<void> {
  try {
    const directory = FileSystem.cacheDirectory;
    if (!directory) return;
    const names = await FileSystem.readDirectoryAsync(directory);
    await Promise.all(
      names
        .filter((name) => name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith('.json'))
        .map((name) =>
          FileSystem.deleteAsync(`${directory}${name}`, { idempotent: true }).catch(
            () => undefined,
          ),
        ),
    );
  } catch {
    // Cleaning is best effort: the cache is also emptied by the system.
  }
}

/** Lets the person choose a backup file. Returns null when they cancel. */
export async function pickBackup(): Promise<BackupFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Many Android providers report a .json file as application/octet-stream, so
    // filtering by type would hide it. The content is validated after reading.
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await FileSystem.readAsStringAsync(asset.uri));
  } catch {
    throw new BackupError('No se ha podido leer el archivo: no es un JSON válido.');
  } finally {
    // The picker copied the file into the cache; it is no longer needed.
    await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined);
  }

  return parseBackup(parsed, LATEST_SCHEMA_VERSION);
}
