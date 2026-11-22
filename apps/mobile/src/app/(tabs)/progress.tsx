import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { PROFILE_LIMITS, computeBmi, type BmiResult } from '@jfood/core';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Segmented } from '@/components/Segmented';
import { useAchievements } from '@/features/achievements/useAchievements';
import { AchievementsSection } from '@/features/progress/components/AchievementsSection';
import { CaloriesSection } from '@/features/progress/components/CaloriesSection';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import { addDays, formatLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { hapticSuccess, hapticWarning } from '@/features/haptics/haptics';
import { FadeInView } from '@/features/motion/FadeInView';
import { animateNextLayout } from '@/features/motion/motion';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useWeightLogs } from '@/features/progress/hooks/useWeightLogs';
import { computeChartPoints, tooltipLeft } from '@/features/progress/utils/chart';
import {
  computeChange,
  computeWeeklyTrend,
} from '@/features/progress/utils/trend';
import {
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';
import type { WeightLog } from '@/data/sqlite/repositories/weightRepository';

const PERIOD_OPTIONS = [
  { label: '7 días', value: 7 },
  { label: '14 días', value: 14 },
  { label: '30 días', value: 30 },
  { label: '90 días', value: 90 },
] as const;

const SECTIONS = [
  { value: 'weight', label: 'Peso' },
  { value: 'calories', label: 'Calorías' },
  { value: 'achievements', label: 'Logros' },
] as const;

type Section = (typeof SECTIONS)[number]['value'];

export default function ProgressScreen() {
  const { colors } = useTheme();
  const [section, setSection] = useState<Section>('weight');
  const { achievements } = useAchievements();
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
  const [chartPeriod, setChartPeriod] = useState<number>(7);

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

    if (
      parsedWeight < PROFILE_LIMITS.minWeightKg ||
      parsedWeight > PROFILE_LIMITS.maxWeightKg
    ) {
      setFormError(
        `El peso debe estar entre ${PROFILE_LIMITS.minWeightKg} y ${PROFILE_LIMITS.maxWeightKg} kg.`,
      );
      return;
    }

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
  const chartLogs = getRecentLogs(sortedLogs, chartPeriod);

  const bmi: BmiResult | null =
    latest && profile.profile?.heightCm
      ? computeBmi(latest.weightKg, profile.profile.heightCm)
      : null;

  return (
    <Screen>
      <ScreenHeader
        title="Tu progreso"
        subtitle="Peso, calorías y logros"
      />

      <Segmented
        accessibilityLabel="Sección de progreso"
        onChange={setSection}
        options={SECTIONS}
        value={section}
      />

      {section === 'calories' ? <CaloriesSection /> : null}
      {section === 'achievements' ? <AchievementsSection achievements={achievements} /> : null}

      {section === 'weight' ? (
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

          <View style={styles.chipRow}>
            {weeklyTrend !== null ? (
              <View style={styles.trendChip}>
                <Ionicons color={colors.primary} name="scale-outline" size={18} />
                <Text style={styles.trendChipText}>
                  Media 7 días:{' '}
                  <Text style={styles.trendChipValue}>
                    {weeklyTrend.toFixed(1)} kg
                  </Text>
                </Text>
              </View>
            ) : null}
            {bmi ? <BmiChip bmi={bmi} /> : null}
          </View>
        </Card>
      ) : null}

      {chartLogs.length > 1 ? (
        <Card>
          <SectionHeader title="Evolución" />
          <View style={styles.periodSelector}>
            {PERIOD_OPTIONS.map(({ label, value }) => (
              <PeriodButton
                key={label}
                active={chartPeriod === value}
                label={label}
                onPress={() => setChartPeriod(value)}
              />
            ))}
          </View>
          <FadeInView key={chartPeriod}>
            <WeightLineChart logs={chartLogs} />
          </FadeInView>
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
            maximumDate={new Date()}
            mode="date"
            value={parseLocalDate(date) ?? new Date()}
            onChange={handleDateChange}
          />
        ) : null}

        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          accessibilityLabel="Peso en kilogramos"
          keyboardType="decimal-pad"
          onChangeText={setWeight}
          placeholder="Ej. 70,5"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={weight}
        />

        <Text style={styles.label}>Nota (opcional)</Text>
        <TextInput
          accessibilityLabel="Nota opcional del registro"
          onChangeText={setNote}
          placeholder="Ej. después de entrenar"
          placeholderTextColor={colors.textMuted}
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
          <FlatList
            data={sortedLogs}
            keyExtractor={(item) => item.localDate}
            renderItem={({ item: log }) => (
              <Pressable
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
            )}
            scrollEnabled={false}
          />
        )}
      </Card>
        </>
      ) : null}

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

function PeriodButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        hapticSuccess();
        onPress();
      }}
      style={[styles.periodButton, active && styles.periodButtonActive]}
    >
      <Text
        style={[
          styles.periodButtonText,
          active && styles.periodButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BmiChip({ bmi }: { bmi: BmiResult }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.bmiChip}>
      <Ionicons color={colors.primary} name="body-outline" size={18} />
      <Text style={styles.bmiChipText}>
        IMC{' '}
        <Text style={styles.bmiChipValue}>
          {bmi.value} · {bmi.label}
        </Text>
      </Text>
    </View>
  );
}

function WeightLineChart({ logs }: { logs: WeightLog[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const width = 300;
  const height = 140;
  const padding = { top: 24, bottom: 24, left: 8, right: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // X is proportional to the calendar (a gap in the logs looks like a gap).
  const points = computeChartPoints(logs, chartWidth, chartHeight);
  // The SVG is scaled to the container, so tooltip pixels need the same scale.
  const scale = containerWidth > 0 ? containerWidth / width : 1;

  const linePath = points
    .map((point, index) =>
      index === 0
        ? `M ${point.x} ${point.y}`
        : `L ${point.x} ${point.y}`,
    )
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${chartHeight} L ${points[0]?.x ?? 0} ${chartHeight} Z`;

  const selected = selectedIndex !== null ? points[selectedIndex] : null;

  return (
    <View
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={styles.chartContainer}
    >
      <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
        <Defs>
          <LinearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#areaFill)" />
        <Path
          d={linePath}
          fill="none"
          stroke={colors.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        <Line
          stroke={colors.border}
          strokeDasharray="4 4"
          strokeWidth={1}
          x1={padding.left}
          x2={width - padding.right}
          y1={chartHeight + padding.top}
          y2={chartHeight + padding.top}
        />
        {points.map((point, index) => (
          <Circle
            key={point.localDate}
            cx={point.x + padding.left}
            cy={point.y + padding.top}
            fill={selectedIndex === index ? colors.accent : colors.surface}
            onPress={() => setSelectedIndex(index)}
            r={selectedIndex === index ? 6 : 4}
            stroke={colors.primary}
            strokeWidth={2}
          />
        ))}
        {points[0] ? (
          <SvgText
            fill={colors.textMuted}
            fontSize={10}
            textAnchor="start"
            x={padding.left}
            y={height - 4}
          >
            {formatShortDay(points[0].localDate)}
          </SvgText>
        ) : null}
        {(() => {
          const lastPoint = points.at(-1);
          return lastPoint ? (
            <SvgText
              fill={colors.textMuted}
              fontSize={10}
              textAnchor="end"
              x={width - padding.right}
              y={height - 4}
            >
              {formatShortDay(lastPoint.localDate)}
            </SvgText>
          ) : null;
        })()}
      </Svg>

      {selected ? (
        <FadeInView
          key={selected.localDate}
          onLayout={(event) => setTooltipWidth(event.nativeEvent.layout.width)}
          style={[
            styles.tooltip,
            {
              left: tooltipLeft(
                (selected.x + padding.left) * scale,
                tooltipWidth,
                containerWidth > 0 ? containerWidth : width,
              ),
            },
          ]}
        >
          <Text style={styles.tooltipText}>
            {selected.weightKg.toFixed(1)} kg
          </Text>
          <Text style={styles.tooltipDate}>
            {formatShortDay(selected.localDate)}
          </Text>
        </FadeInView>
      ) : null}
    </View>
  );
}

function formatShortDay(localDate: string): string {
  const [, , day] = localDate.split('-');
  return day ?? '';
}

function getRecentLogs(logs: WeightLog[], days: number): WeightLog[] {
  if (days <= 0) return logs;
  if (logs.length === 0) return [];

  const latest = logs[logs.length - 1];
  if (!latest) return [];

  const cutoffString = addDays(latest.localDate, -days + 1);
  return logs.filter((log) => log.localDate >= cutoffString);
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorBanner: {
      backgroundColor: colors.dangerLight,
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
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    trendChip: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
    },
    trendChipText: {
      ...typography.caption,
      color: colors.primary,
    },
    trendChipValue: {
      fontWeight: '700',
    },
    bmiChip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
    },
    bmiChipText: {
      ...typography.caption,
      color: colors.text,
    },
    bmiChipValue: {
      fontWeight: '700',
    },
    periodSelector: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    periodButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      paddingVertical: spacing.sm,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonText: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '700',
    },
    periodButtonTextActive: {
      color: colors.textOnPrimary,
    },
    chartContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    tooltip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      elevation: 3,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      position: 'absolute',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      top: 0,
    },
    tooltipText: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
      textAlign: 'center',
    },
    tooltipDate: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
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
}
