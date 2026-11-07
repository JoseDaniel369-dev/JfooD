import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Fragment, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useWeightLogs } from '@/features/progress/hooks/useWeightLogs';
import {
  computeChange,
  computeWeeklyTrend,
} from '@/features/progress/utils/trend';
import { formatLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { colors, radius, spacing, typography } from '@/theme';
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    if (!editingDate) return;

    void (async () => {
      try {
        await remove(editingDate);
        resetForm();
      } catch {
        // Error silencioso; useWeightLogs ya muestra banner.
      }
    })();
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(toLocalDate(selectedDate));
    }
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
  const recentLogs = getRecentLogs(sortedLogs, 7);

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
        <Card>
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

      {recentLogs.length > 1 ? (
        <Card>
          <SectionHeader title="Últimos 7 días" />
          <WeightChart logs={recentLogs} selectedDate={editingDate} />
        </Card>
      ) : null}

      <Card>
        <SectionHeader
          title={editingDate ? 'Editar registro' : 'Registrar peso'}
        />

        <Text style={styles.label}>Fecha</Text>
        {editingDate ? (
          <View style={styles.lockedDate}>
            <Text style={styles.lockedDateText}>{formatLocalDate(date)}</Text>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Seleccionar fecha"
            accessibilityRole="button"
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
          >
            <Text style={styles.dateButtonText}>{formatLocalDate(date)}</Text>
            <Ionicons color={colors.primary} name="calendar-outline" size={18} />
          </Pressable>
        )}

        {showDatePicker && !editingDate ? (
          <DateTimePicker
            mode="date"
            value={parseLocalDate(date) ?? new Date()}
            onChange={handleDateChange}
          />
        ) : null}

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
            <View style={styles.secondaryButton}>
              <Button title="Cancelar" variant="secondary" onPress={resetForm} />
            </View>
          ) : null}
          <View style={styles.primaryButton}>
            <Button
              loading={saving}
              title={editingDate ? 'Guardar cambios' : 'Guardar'}
              onPress={handleSave}
            />
          </View>
        </View>

        {editingDate ? (
          <Button
            icon="trash-outline"
            title="Eliminar registro"
            variant="ghost"
            onPress={() => setShowDeleteConfirm(true)}
          />
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Historial" />
        {logs.length === 0 ? (
          <EmptyState
            icon="scale-outline"
            message="Añade tu primer registro de peso arriba."
            title="Sin registros"
          />
        ) : (
          <View style={styles.historyList}>
            {sortedLogs.map((log) => (
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
          </View>
        )}
      </Card>

      <ConfirmDialog
        confirmLabel="Eliminar"
        destructive
        message={`¿Seguro que quieres eliminar el peso del ${formatLocalDate(editingDate ?? '')}?`}
        title="Eliminar registro"
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
      />
    </Screen>
  );
}

function getRecentLogs(logs: WeightLog[], days: number): WeightLog[] {
  if (logs.length === 0) return [];
  const latest = logs[logs.length - 1];
  const cutoff = new Date(latest?.localDate ?? '');
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffString = toLocalDate(cutoff);
  return logs.filter((log) => log.localDate >= cutoffString);
}

function WeightChart({
  logs,
  selectedDate,
}: {
  logs: WeightLog[];
  selectedDate: string | null;
}) {
  const chartHeight = 120;
  const barWidth = 24;
  const gap = 8;
  const weights = logs.map((log) => log.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = Math.max(maxWeight - minWeight, 1);
  const paddingBottom = 20;

  return (
    <Svg
      height={chartHeight + paddingBottom}
      viewBox={`0 0 ${logs.length * (barWidth + gap)} ${chartHeight + paddingBottom}`}
      width="100%"
    >
      {logs.map((log, index) => {
        const x = index * (barWidth + gap) + gap / 2;
        const barHeight =
          ((log.weightKg - minWeight) / range) * (chartHeight - 24) + 8;
        const y = chartHeight - barHeight;

        return (
          <Fragment key={log.localDate}>
            <Rect
              fill={colors.primary}
              height={barHeight}
              opacity={selectedDate === log.localDate ? 1 : 0.85}
              rx={6}
              width={barWidth}
              x={x}
              y={y}
            />
            <SvgText
              fill={colors.textMuted}
              fontSize={10}
              textAnchor="middle"
              x={x + barWidth / 2}
              y={chartHeight + 14}
            >
              {formatChartDay(log.localDate)}
            </SvgText>
          </Fragment>
        );
      })}
    </Svg>
  );
}

function formatChartDay(localDate: string): string {
  const [, , day] = localDate.split('-');
  return day ?? '';
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

function parseLocalDate(localDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  if (
    date.getFullYear() === year &&
    date.getMonth() === (month ?? 1) - 1 &&
    date.getDate() === day
  ) {
    return date;
  }
  return null;
}

const styles = StyleSheet.create({
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
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
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    ...typography.title,
    color: colors.text,
    fontSize: 28,
  },
  summaryUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
  },
  summaryDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  up: {
    color: colors.danger,
  },
  down: {
    color: colors.success,
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
    ...typography.caption,
    color: colors.primary,
  },
  trendValue: {
    fontWeight: '700',
  },
  label: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
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
  dateButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  dateButtonText: {
    color: colors.text,
    fontSize: 16,
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
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
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
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  historyNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
  historyWeight: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  historyUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.75,
  },
});
