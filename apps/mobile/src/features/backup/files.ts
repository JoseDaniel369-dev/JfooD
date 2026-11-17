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

  const backup = await exportBackup(database);
  const uri = `${FileSystem.cacheDirectory}jfood-copia-${toLocalDate(new Date())}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup));

  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Guardar copia de seguridad de JfooD',
    UTI: 'public.json',
  });
}

/** Lets the person choose a backup file. Returns null when they cancel. */
export async function pickBackup(): Promise<BackupFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
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
  }

  return parseBackup(parsed, LATEST_SCHEMA_VERSION);
}
