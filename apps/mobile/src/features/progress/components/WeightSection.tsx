import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PROFILE_LIMITS, computeBmi, type BmiResult } from '@jfood/core';

import { ErrorState } from '@/components/AsyncState';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ScreenSkeleton } from '@/components/Skeleton';
import { SectionHeader } from '@/components/SectionHeader';
import { Segmented } from '@/components/Segmented';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import type { WeightLog } from '@/data/sqlite/repositories/weightRepository';
import {
  addDays,
  formatLocalDate,
  isValidLocalDate,
  parseLocalDate,
  toLocalDate,
} from '@/features/diary/utils/date';
import { parseSpanishNumber } from '@/features/foods/utils/parseNumber';
import { hapticSuccess, hapticWarning } from '@/features/haptics/haptics';
import { animateNextLayout } from '@/features/motion/motion';
import { fadeUp } from '@/features/motion/springs';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { WeightChart } from '@/features/progress/components/WeightChart';
import { useWeightLogs } from '@/features/progress/hooks/useWeightLogs';
import {
  computeChange,
  computeWeeklyTrend,
  weightChangeTone,
  type ChangeTone,
} from '@/features/progress/utils/trend';
import {
  fonts,
  radius,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

const PERIOD_OPTIONS = [
  { label: '7 días', value: '7' },
  { label: '14 días', value: '14' },
  { label: '30 días', value: '30' },
  { label: '90 días', value: '90' },
] as const;

/** Rows of the history shown before "Ver todo". */
const HISTORY_PREVIEW = 10;

interface WeightSectionProps {
  /** Scrolls the screen so that this vertical position (inside the content) is visible. */
  scrollTo?: (y: number) => void;
}

/** Weight tab of Progress: current weight, evolution chart, the form and the history. */
export function WeightSection({ scrollTo }: WeightSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const { logs, loading, error, load, save, remove } = useWeightLogs();
  const profile = useProfile();
  const today = toLocalDate(new Date());

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<(typeof PERIOD_OPTIONS)[number]['value']>('7');
  const [showAll, setShowAll] = useState(false);
  /** Set at once: two quick taps on "Guardar" save once. */
  const savingRef = useRef(false);
  const formY = useRef(0);

  const resetForm = () => {
    setDate(today);
    setWeight('');
    setNote('');
    setEditingDate(null);
    setFormError(null);
  };

  const handleSelectLog = (log: WeightLog) => {
    setEditingDate(log.localDate);
    setDate(log.localDate);
    setWeight(String(log.weightKg).replace('.', ','));
    setNote(log.note ?? '');
    setFormError(null);
    // The form is above the history: bring it into view.
    scrollTo?.(Math.max(formY.current - spacing.lg, 0));
  };

  const handleSave = async (confirmedOverwrite = false) => {
    if (savingRef.current) return;
    setFormError(null);

    if (!editingDate && !isValidLocalDate(date)) {
      setFormError('Introduce una fecha válida.');
      return;
    }

    const parsedWeight = parseSpanishNumber(weight);
    if (parsedWeight === null || parsedWeight <= 0) {
      setFormError('Introduce un peso válido en kilogramos.');
      return;
    }
    if (parsedWeight < PROFILE_LIMITS.minWeightKg || parsedWeight > PROFILE_LIMITS.maxWeightKg) {
      setFormError(
        `El peso debe estar entre ${PROFILE_LIMITS.minWeightKg} y ${PROFILE_LIMITS.maxWeightKg} kg.`,
      );
      return;
    }

    // A new record on a day that already has one would silently replace it.
    if (!editingDate && !confirmedOverwrite && logs.some((log) => log.localDate === date)) {
      setShowOverwriteConfirm(true);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await save({
        localDate: editingDate ?? date,
        weightKg: parsedWeight,
        note: note.trim() || null,
      });
      hapticSuccess();
      showToast(editingDate ? 'Peso actualizado.' : 'Peso guardado.');
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    if (!editingDate) return;

    void (async () => {
      try {
        animateNextLayout();
        await remove(editingDate);
        hapticWarning();
        showToast('Registro eliminado.');
        resetForm();
      } catch {
        showToast('No se ha podido eliminar el registro.', 'error');
      }
    })();
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setDate(toLocalDate(selectedDate));
    }
  };

  if (loading && logs.length === 0) {
    return <ScreenSkeleton />;
  }
  if (error && logs.length === 0) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  const sortedLogs = [...logs].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const latest = sortedLogs[sortedLogs.length - 1] ?? null;
  const previous = sortedLogs[sortedLogs.length - 2] ?? null;
  const change = latest ? computeChange(latest.weightKg, previous?.weightKg ?? null) : null;
  const tone = weightChangeTone(change, profile.profile?.goalType);
  const weeklyTrend = computeWeeklyTrend(sortedLogs);
  const chartLogs = getRecentLogs(sortedLogs, Number(chartPeriod));
  const bmi: BmiResult | null =
    latest && profile.profile?.heightCm ? computeBmi(latest.weightKg, profile.profile.heightCm) : null;

  const history = [...sortedLogs].reverse();
  const visibleHistory = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <>
      {error && logs.length > 0 ? (
        <Card style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </Card>
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
              <Text style={styles.summaryDate}>{formatLocalDate(latest.localDate)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cambio</Text>
              <Text style={[styles.summaryValue, { color: toneColor(tone, colors) }]}>
                {change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}`}
                {change === null ? null : <Text style={styles.summaryUnit}> kg</Text>}
              </Text>
              <Text style={styles.summaryDate}>
                {previous ? `vs. ${formatLocalDate(previous.localDate)}` : 'sin registro previo'}
              </Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {weeklyTrend !== null ? (
              <View style={styles.infoChip}>
                <Ionicons color={colors.primary} name="analytics-outline" size={18} />
                <Text style={styles.infoChipText}>
                  Media 7 días: <Text style={styles.infoChipValue}>{weeklyTrend.toFixed(1)} kg</Text>
                </Text>
              </View>
            ) : null}
            {bmi ? (
              <View style={styles.infoChip}>
                <Ionicons color={colors.primary} name="body-outline" size={18} />
                <Text style={styles.infoChipText}>
                  IMC{' '}
                  <Text style={styles.infoChipValue}>
                    {bmi.value} · {bmi.label}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {sortedLogs.length > 1 ? (
        <Card>
          <SectionHeader caption="Arrastra el dedo por la gráfica para ver cada día" title="Evolución" />
          <Segmented
            accessibilityLabel="Periodo de la gráfica"
            onChange={setChartPeriod}
            options={PERIOD_OPTIONS}
            value={chartPeriod}
          />
          {chartLogs.length > 1 ? (
            <Animated.View key={chartPeriod} entering={fadeUp()}>
              <WeightChart logs={chartLogs} />
            </Animated.View>
          ) : (
            <Text style={styles.summaryDate}>
              Hay menos de dos registros en este periodo. Prueba con uno más largo.
            </Text>
          )}
        </Card>
      ) : null}

      <View onLayout={(event) => (formY.current = event.nativeEvent.layout.y)}>
        <Card>
          <SectionHeader title={editingDate ? 'Editar registro' : 'Registrar peso'} />

          <View style={styles.field}>
            <Text style={styles.label}>Fecha</Text>
            {editingDate ? (
              <View style={styles.lockedDate}>
                <Text style={styles.lockedDateText}>{formatLocalDate(date)}</Text>
              </View>
            ) : (
              <Pressable
                accessibilityLabel={`Fecha: ${formatLocalDate(date)}. Cambiar`}
                accessibilityRole="button"
                onPress={() => setShowDatePicker(true)}
                style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
              >
                <Text style={styles.dateButtonText}>{formatLocalDate(date)}</Text>
                <Ionicons color={colors.primary} name="calendar-outline" size={20} />
              </Pressable>
            )}
          </View>

          {showDatePicker && !editingDate ? (
            <DateTimePicker
              maximumDate={new Date()}
              mode="date"
              value={parseLocalDate(date) ?? new Date()}
              onChange={handleDateChange}
            />
          ) : null}

          <TextField
            keyboardType="decimal-pad"
            label="Peso (kg)"
            onChangeText={setWeight}
            placeholder="Ej. 70,5"
            value={weight}
          />
          <TextField
            label="Nota (opcional)"
            onChangeText={setNote}
            placeholder="Ej. después de entrenar"
            value={note}
          />

          {formError ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {formError}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            {editingDate ? (
              <View style={styles.buttonFlex}>
                <Button title="Cancelar" variant="secondary" onPress={resetForm} />
              </View>
            ) : null}
            <View style={styles.buttonFlex}>
              <Button
                loading={saving}
                title={editingDate ? 'Guardar cambios' : 'Guardar'}
                onPress={() => void handleSave()}
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
      </View>

      <Card>
        <SectionHeader
          caption={history.length > 0 ? `${history.length} registro${history.length === 1 ? '' : 's'}` : undefined}
          title="Historial"
        />
        {history.length === 0 ? (
          <EmptyState
            icon="scale-outline"
            message="Añade tu primer registro de peso arriba."
            title="Sin registros"
          />
        ) : (
          <View>
            {visibleHistory.map((log) => (
              <Pressable
                key={log.localDate}
                accessibilityHint="Toca para editarlo"
                accessibilityLabel={`Peso ${log.weightKg} kilos el ${formatLocalDate(log.localDate)}`}
                accessibilityRole="button"
                onPress={() => handleSelectLog(log)}
                style={({ pressed }) => [
                  styles.historyRow,
                  editingDate === log.localDate && styles.historyRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.historyMain}>
                  <Text style={styles.historyDate}>{formatLocalDate(log.localDate)}</Text>
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
            {history.length > HISTORY_PREVIEW ? (
              <Button
                icon={showAll ? 'chevron-up' : 'chevron-down'}
                title={showAll ? 'Ver menos' : `Ver todo (${history.length})`}
                variant="ghost"
                onPress={() => {
                  animateNextLayout();
                  setShowAll((current) => !current);
                }}
              />
            ) : null}
          </View>
        )}
      </Card>

      <ConfirmDialog
        confirmLabel="Reemplazar"
        message={`Ya tienes un peso registrado el ${formatLocalDate(date)}. ¿Quieres reemplazarlo?`}
        title="Ya hay un registro ese día"
        visible={showOverwriteConfirm}
        onClose={() => setShowOverwriteConfirm(false)}
        onConfirm={() => void handleSave(true)}
      />
      <ConfirmDialog
        confirmLabel="Eliminar"
        destructive
        message={`¿Seguro que quieres eliminar el peso del ${formatLocalDate(editingDate ?? '')}?`}
        title="Eliminar registro"
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

function toneColor(tone: ChangeTone, colors: ThemeColors): string {
  if (tone === 'good') return colors.successText;
  if (tone === 'attention') return colors.warning;
  return colors.text;
}

function getRecentLogs(logs: WeightLog[], days: number): WeightLog[] {
  const latest = logs[logs.length - 1];
  if (!latest) return [];
  const cutoff = addDays(latest.localDate, -days + 1);
  return logs.filter((log) => log.localDate >= cutoff);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorBanner: {
      backgroundColor: colors.dangerLight,
    },
    errorBannerText: {
      ...typography.caption,
      color: colors.danger,
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
      ...typography.label,
      color: colors.textMuted,
    },
    summaryValue: {
      ...typography.titleLarge,
      ...tabularNumbers,
      color: colors.text,
    },
    summaryUnit: {
      ...typography.body,
      color: colors.textMuted,
    },
    summaryDate: {
      ...typography.caption,
      color: colors.textMuted,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    infoChip: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 36,
      paddingHorizontal: spacing.md,
    },
    infoChipText: {
      ...typography.caption,
      color: colors.text,
    },
    infoChipValue: {
      ...typography.captionStrong,
      color: colors.text,
    },
    field: {
      gap: spacing.xs,
    },
    label: {
      ...typography.captionStrong,
      color: colors.text,
    },
    dateButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1.5,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    dateButtonText: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.body.fontSize + 1,
    },
    lockedDate: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      justifyContent: 'center',
      minHeight: 48,
      opacity: 0.8,
      paddingHorizontal: spacing.md,
    },
    lockedDateText: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.body.fontSize + 1,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    buttonFlex: {
      flex: 1,
    },
    historyRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      // A transparent border in every row, so selecting one does not move the list.
      borderLeftColor: 'transparent',
      borderLeftWidth: 3,
      flexDirection: 'row',
      gap: spacing.md,
      minHeight: 52,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    historyRowActive: {
      backgroundColor: colors.primaryLight,
      borderLeftColor: colors.primary,
      borderRadius: radius.sm,
    },
    historyMain: {
      flex: 1,
      gap: 2,
    },
    historyDate: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    historyNote: {
      ...typography.caption,
      color: colors.textMuted,
    },
    historyWeight: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
    },
    historyUnit: {
      ...typography.caption,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
