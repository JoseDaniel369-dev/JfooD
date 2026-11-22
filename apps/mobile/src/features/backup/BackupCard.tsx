import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { seedCatalog } from '@/data/seed/seedCatalog';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import {
  BackupError,
  restoreBackup,
  type BackupCounts,
  type BackupFile,
} from '@/features/backup/backup';
import { pickBackup, shareBackup } from '@/features/backup/files';
import { hapticSuccess, hapticWarning } from '@/features/haptics/haptics';
import { spacing, typography, useTheme, type ThemeColors } from '@/theme';

function describe(counts: BackupCounts): string {
  return `${counts.diary_entries} entradas del diario, ${counts.weight_logs} pesos y ${counts.foods} alimentos`;
}

/** Export and restore of all personal data: the only way out of the sandbox. */
export function BackupCard({ onRestored }: { onRestored?: () => void }) {
  const { colors, reloadPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<'export' | 'import' | 'restore' | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);

  const message = (error: unknown, fallback: string) =>
    error instanceof BackupError ? error.message : fallback;

  const handleExport = async () => {
    setBusy('export');
    try {
      await shareBackup(database);
    } catch (error) {
      showToast(message(error, 'No se ha podido crear la copia.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePick = async () => {
    setBusy('import');
    try {
      const backup = await pickBackup();
      if (backup) {
        setPending(backup);
      }
    } catch (error) {
      showToast(message(error, 'No se ha podido abrir el archivo.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    const backup = pending;
    setPending(null);
    if (!backup) return;

    setBusy('restore');
    try {
      const counts = await restoreBackup(database, backup);
      // A copy made before the base catalog existed replaces the foods table
      // with one that lacks it: load it again right away.
      await seedCatalog(database).catch(() => false);
      // The copy may carry another theme: apply it without restarting the app.
      await reloadPreference();
      hapticSuccess();
      showToast(`Copia restaurada: ${describe(counts)}.`);
      onRestored?.();
    } catch (error) {
      hapticWarning();
      showToast(message(error, 'No se ha podido restaurar la copia.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const pendingRows = pending
    ? `${pending.tables.diary_entries?.length ?? 0} entradas del diario, ${pending.tables.weight_logs?.length ?? 0} pesos y ${pending.tables.foods?.length ?? 0} alimentos`
    : '';

  return (
    <Card>
      <SectionHeader title="Tus datos" />
      <Text style={styles.text}>
        Todo se guarda solo en este móvil. Crea una copia para no perderlo si
        cambias de teléfono o reinstalas la app.
      </Text>
      <Button
        disabled={busy !== null}
        icon="share-outline"
        loading={busy === 'export'}
        title="Exportar copia de seguridad"
        variant="secondary"
        onPress={() => void handleExport()}
      />
      <Button
        disabled={busy !== null}
        icon="download-outline"
        loading={busy === 'import' || busy === 'restore'}
        title="Restaurar desde un archivo"
        variant="ghost"
        onPress={() => void handlePick()}
      />

      <ConfirmDialog
        confirmLabel="Reemplazar mis datos"
        destructive
        message={`La copia contiene ${pendingRows}. Se reemplazarán todos los datos actuales de la app. Esta acción no se puede deshacer.`}
        title="Restaurar copia"
        visible={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void handleRestore()}
      />
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    text: {
      ...typography.body,
      color: colors.textMuted,
      marginBottom: spacing.md,
    },
  });
}
