import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ErrorState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenSkeleton } from '@/components/Skeleton';
import { addDays, formatLocalDate, startOfWeek, toLocalDate } from '@/features/diary/utils/date';
import { formatWeekRange } from '@/features/diary/utils/weekStrip';
import { formatGrams } from '@/features/diary/utils/totals';
import type { WeekSummary } from '@/features/insights/buildWeekSummary';
import { useWeekSummary } from '@/features/insights/useWeekSummary';
import { staggerIn } from '@/features/motion/springs';
import { radius, spacing, tabularNumbers, typography, useTheme, type ThemeColors } from '@/theme';

/** The week in numbers: calories against the goal, macros, water and weight. */
export default function SummaryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = toLocalDate(new Date());
  const thisMonday = startOfWeek(today);
  const [monday, setMonday] = useState(thisMonday);
  const { summary, goalKcal, loading, error } = useWeekSummary(monday);

  const isCurrentWeek = monday === thisMonday;

  return (
    <Screen>
      <ScreenHeader subtitle="Cómo ha ido tu semana" title="Resumen semanal" />

      <View style={styles.weekNav}>
        <AnimatedPressable
          accessibilityLabel="Semana anterior"
          accessibilityRole="button"
          haptic
          onPress={() => setMonday((current) => addDays(current, -7))}
          style={styles.arrow}
        >
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </AnimatedPressable>
        <Text style={styles.range}>
          {formatWeekRange(monday)}
          {isCurrentWeek ? ' · esta semana' : ''}
        </Text>
        <AnimatedPressable
          accessibilityLabel="Semana siguiente"
          accessibilityRole="button"
          disabled={isCurrentWeek}
          haptic
          onPress={() => setMonday((current) => addDays(current, 7))}
          style={[styles.arrow, isCurrentWeek && styles.arrowDisabled]}
        >
          <Ionicons color={colors.text} name="chevron-forward" size={22} />
        </AnimatedPressable>
      </View>

      {loading ? (
        <ScreenSkeleton />
      ) : error || !summary ? (
        <ErrorState message={error ?? 'No hay datos disponibles.'} onRetry={() => setMonday((m) => m)} />
      ) : summary.loggedDays === 0 ? (
        <EmptyState
          actionLabel="Registrar una comida"
          icon="calendar-outline"
          message="No hay comidas registradas en esta semana."
          title="Semana vacía"
          onAction={() => router.push('/diary/add-food')}
        />
      ) : (
        <SummaryContent goalKcal={goalKcal} summary={summary} />
      )}
    </Screen>
  );
}

function SummaryContent({ summary, goalKcal }: { summary: WeekSummary; goalKcal: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const change = summary.kcalChangeVsPrevious;

  return (
    <>
      <Animated.View entering={staggerIn(0)}>
        <Card variant="hero">
          <Text style={styles.heroLabel}>MEDIA DIARIA</Text>
          <Text style={styles.heroValue}>
            {summary.averageKcal === null ? '—' : summary.averageKcal}
            <Text style={styles.heroUnit}> kcal</Text>
          </Text>
          <Text style={styles.heroLine}>Objetivo: {Math.round(goalKcal)} kcal al día</Text>
          {change !== null ? (
            <View style={styles.changeRow}>
              <Ionicons
                color={colors.onHero}
                name={change > 0 ? 'trending-up' : change < 0 ? 'trending-down' : 'remove'}
                size={18}
              />
              <Text style={styles.heroLine}>
                {change === 0
                  ? 'Igual que la semana anterior'
                  : `${change > 0 ? '+' : ''}${change} kcal frente a la semana anterior`}
              </Text>
            </View>
          ) : null}
          {summary.comparableDays > 0 ? (
            <Text style={styles.heroNote}>
              {summary.daysOnTarget} de {summary.comparableDays}{' '}
              {summary.comparableDays === 1 ? 'día' : 'días'} cerca del objetivo (±10 %)
            </Text>
          ) : (
            <Text style={styles.heroNote}>
              Hay alimentos sin calorías: completa sus datos para ver la media.
            </Text>
          )}
        </Card>
      </Animated.View>

      {summary.macroSplit ? (
        <Animated.View entering={staggerIn(1)}>
          <Card>
            <SectionHeader caption="De dónde viene tu energía" title="Reparto de macros" />
            <View
              accessibilityLabel={`Proteínas ${summary.macroSplit.proteinPercent} por ciento, hidratos ${summary.macroSplit.carbohydratePercent}, grasas ${summary.macroSplit.fatPercent}`}
              style={styles.splitBar}
            >
              <View style={[styles.splitPart, { backgroundColor: colors.protein, flex: Math.max(summary.macroSplit.proteinPercent, 1) }]} />
              <View style={[styles.splitPart, { backgroundColor: colors.carbohydrates, flex: Math.max(summary.macroSplit.carbohydratePercent, 1) }]} />
              <View style={[styles.splitPart, { backgroundColor: colors.fat, flex: Math.max(summary.macroSplit.fatPercent, 1) }]} />
            </View>
            <View style={styles.legend}>
              <LegendItem color={colors.protein} label="Proteínas" percent={summary.macroSplit.proteinPercent} />
              <LegendItem color={colors.carbohydrates} label="Hidratos" percent={summary.macroSplit.carbohydratePercent} />
              <LegendItem color={colors.fat} label="Grasas" percent={summary.macroSplit.fatPercent} />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={staggerIn(2)}>
        <Card>
          <SectionHeader title="Datos de la semana" />
          <View style={styles.facts}>
            <Fact emoji="📅" label="Días registrados" value={`${summary.loggedDays} de 7`} />
            {summary.closestToGoal ? (
              <Fact
                emoji="🎯"
                label="Día más cercano al objetivo"
                value={`${formatLocalDate(summary.closestToGoal.localDate)} · ${summary.closestToGoal.caloriesKcal} kcal`}
              />
            ) : null}
            {summary.highestDay ? (
              <Fact
                emoji="📈"
                label="Día con más calorías"
                value={`${formatLocalDate(summary.highestDay.localDate)} · ${summary.highestDay.caloriesKcal} kcal`}
              />
            ) : null}
            {summary.averageProteinGrams !== null ? (
              <Fact emoji="💪" label="Proteína media" value={`${summary.averageProteinGrams} g al día`} />
            ) : null}
            {summary.averageWaterMl !== null ? (
              <Fact
                emoji="💧"
                label="Agua media"
                value={`${formatGrams(summary.averageWaterMl / 1000)} L al día · objetivo ${summary.waterGoalDays} ${summary.waterGoalDays === 1 ? 'día' : 'días'}`}
              />
            ) : null}
            {summary.weightChangeKg !== null ? (
              <Fact
                emoji="⚖️"
                label="Cambio de peso"
                value={`${summary.weightChangeKg > 0 ? '+' : ''}${formatGrams(summary.weightChangeKg)} kg`}
              />
            ) : null}
          </View>
        </Card>
      </Animated.View>
    </>
  );
}

function LegendItem({ color, label, percent }: { color: string; label: string; percent: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>
        {label} {percent} %
      </Text>
    </View>
  );
}

function Fact({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.fact}>
      <Text style={styles.factEmoji}>{emoji}</Text>
      <View style={styles.factText}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    weekNav: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    arrow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    arrowDisabled: {
      opacity: 0.35,
    },
    range: {
      ...typography.title,
      color: colors.text,
    },
    heroLabel: {
      ...typography.label,
      color: colors.onHero,
      opacity: 0.8,
    },
    heroValue: {
      ...typography.displayLarge,
      ...tabularNumbers,
      color: colors.onHero,
    },
    heroUnit: {
      ...typography.title,
      color: colors.onHero,
      opacity: 0.85,
    },
    heroLine: {
      ...typography.body,
      color: colors.onHero,
    },
    heroNote: {
      ...typography.caption,
      color: colors.onHero,
      opacity: 0.85,
    },
    changeRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    splitBar: {
      borderRadius: radius.pill,
      flexDirection: 'row',
      gap: 3,
      height: 14,
      overflow: 'hidden',
    },
    splitPart: {
      height: '100%',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    legendDot: {
      borderRadius: radius.pill,
      height: 10,
      width: 10,
    },
    legendText: {
      ...typography.caption,
      ...tabularNumbers,
      color: colors.text,
    },
    facts: {
      gap: spacing.lg,
    },
    fact: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    factEmoji: {
      fontSize: 26,
    },
    factText: {
      flex: 1,
      gap: 2,
    },
    factLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    factValue: {
      ...typography.title,
      color: colors.text,
      fontSize: 16,
    },
  });
}
