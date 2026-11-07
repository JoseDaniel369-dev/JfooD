import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useWeightLogs } from '@/features/progress/hooks/useWeightLogs';
import {
  computeChange,
  computeWeeklyTrend,
} from '@/features/progress/utils/trend';
import { formatLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { colors, radius, spacing } from '@/theme';
import type { WeightLog } from '@/data/sqlite/repositories/weightRepository';

const MAX_WEIGHT_KG = 300;

export default function ProgressScreen() {
  const { logs, loading, error, load, save, remove } = useWeightLogs();
  const today = toLocalDate(new Date());

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setDate(today);
    setWeight('');
    setNote('');
    setEditingDate(null);
    setFormError(null);
  }, [today]);

  const handleSelectLog = (log: WeightLog) => {
    setEditingDate(log.localDate);
    setDate(log.localDate);
    setWeight(String(log.weightKg));
    setNote(log.note ?? '');
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);

    if (!editingDate && !isValidDate(date)) {
      setFormError('Introduce una fecha válida (AAAA-MM-DD).');
      return;
    }

    const parsedWeight = parseWeight(weight);
    if (parsedWeight === null || parsedWeight <= 0) {
      setFormError('Introduce un peso válido en kilogramos.');
      return;
    }

    if (parsedWeight > MAX_WEIGHT_KG) {
      setFormError('El peso no puede superar los 300 kg.');
      return;
    }

    setSaving(true);

    try {
      await save({
        localDate: editingDate ?? date,
        weightKg: parsedWeight,
        note: note.trim() || null,
      });
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingDate) return;

    Alert.alert(
      'Eliminar registro',
      `¿Seguro que quieres eliminar el peso del ${formatLocalDate(editingDate)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(editingDate);
              resetForm();
            } catch {
              Alert.alert('Error', 'No se ha podido eliminar el registro.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  if (loading && logs.length === 0) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error && logs.length === 0) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  const sortedLogs = [...logs].sort((a, b) =>
    a.localDate.localeCompare(b.localDate),
  );
  const latest = sortedLogs[sortedLogs.length - 1] ?? null;
  const previous = sortedLogs[sortedLogs.length - 2] ?? null;
  const change = latest
    ? computeChange(latest.weightKg, previous?.weightKg ?? null)
    : null;
  const weeklyTrend = computeWeeklyTrend(sortedLogs);

  return (
    <Screen>
      <ScreenHeader
        title="Tu progreso"
        subtitle="Registra tu peso y sigue la evolución"
      />

      {error && logs.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {latest ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Peso actual</Text>
              <Text style={styles.summaryValue}>
                {latest.weightKg.toFixed(1)}
                <Text style={styles.summaryUnit}> kg</Text>
              </Text>
              <Text style={styles.summaryDate}>
                {formatLocalDate(latest.localDate)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cambio</Text>
              <Text
                style={[
                  styles.summaryValue,
                  change === null
                    ? styles.neutral
                    : change > 0
                      ? styles.up
                      : change < 0
                        ? styles.down
                        : styles.neutral,
                ]}
              >
                {change === null
                  ? '—'
                  : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`}
              </Text>
              <Text style={styles.summaryDate}>
                {previous
                  ? `vs. ${formatLocalDate(previous.localDate)}`
                  : 'sin registro previo'}
              </Text>
            </View>
          </View>
          {weeklyTrend !== null ? (
            <View style={styles.trendRow}>
              <Ionicons
                color={colors.primary}
                name="scale-outline"
                size={18}
              />
              <Text style={styles.trendText}>
                Media de los últimos 7 días:{' '}
                <Text style={styles.trendValue}>
                  {weeklyTrend.toFixed(1)} kg
                </Text>
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>
          {editingDate ? 'Editar registro' : 'Registrar peso'}
        </Text>

        <Text style={styles.label}>Fecha</Text>
        {editingDate ? (
          <View style={styles.lockedDate}>
            <Text style={styles.lockedDateText}>{formatLocalDate(date)}</Text>
          </View>
        ) : (
          <TextInput
            onChangeText={setDate}
            placeholder="AAAA-MM-DD"
            style={styles.input}
            value={date}
          />
        )}

        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setWeight}
          placeholder="Ej. 70,5"
          style={styles.input}
          value={weight}
        />

        <Text style={styles.label}>Nota (opcional)</Text>
        <TextInput
          onChangeText={setNote}
          placeholder="Ej. después de entrenar"
          style={styles.input}
          value={note}
        />

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

        <View style={styles.buttonRow}>
          {editingDate ? (
            <Pressable
              accessibilityRole="button"
              onPress={resetForm}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !saving && styles.pressed,
              saving && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Guardando…' : editingDate ? 'Guardar cambios' : 'Guardar'}
            </Text>
          </Pressable>
        </View>

        {editingDate ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color={colors.danger} name="trash-outline" size={18} />
            <Text style={styles.deleteButtonText}>Eliminar registro</Text>
          </Pressable>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Historial</Text>
        {logs.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons color={colors.textMuted} name="scale-outline" size={36} />
            <Text style={styles.emptyText}>
              Aún no tienes registros de peso. Añade el primero arriba.
            </Text>
          </View>
        ) : (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.historyList}
          >
            {logs.map((log) => (
              <Pressable
                key={log.localDate}
                accessibilityLabel={`Peso ${log.weightKg} kg el ${formatLocalDate(log.localDate)}`}
                accessibilityRole="button"
                onPress={() => handleSelectLog(log)}
                style={({ pressed }) => [
                  styles.historyRow,
                  editingDate === log.localDate && styles.historyRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.historyMain}>
                  <Text style={styles.historyDate}>
                    {formatLocalDate(log.localDate)}
                  </Text>
                  {log.note ? (
                    <Text numberOfLines={1} style={styles.historyNote}>
                      {log.note}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.historyWeight}>
                  {log.weightKg.toFixed(1)}
                  <Text style={styles.historyUnit}> kg</Text>
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Card>
    </Screen>
  );
}

function parseWeight(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === (month ?? 1) - 1 &&
    date.getUTCDate() === day
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    backgroundColor: 'rgba(164, 71, 61, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  summaryCard: {
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryDivider: {
    backgroundColor: colors.border,
    width: 1,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  summaryUnit: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '400',
  },
  summaryDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  up: {
    color: colors.danger,
  },
  down: {
    color: colors.primary,
  },
  neutral: {
    color: colors.textMuted,
  },
  trendRow: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  trendText: {
    color: colors.primary,
    fontSize: 13,
  },
  trendValue: {
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  lockedDate: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  lockedDateText: {
    color: colors.text,
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flex: 1,
    padding: spacing.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyHistory: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  historyList: {
    maxHeight: 280,
  },
  historyRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  historyRowActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  historyMain: {
    flex: 1,
    gap: 2,
  },
  historyDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  historyNote: {
    color: colors.textMuted,
    fontSize: 12,
  },
  historyWeight: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  historyUnit: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.75,
  },
});
