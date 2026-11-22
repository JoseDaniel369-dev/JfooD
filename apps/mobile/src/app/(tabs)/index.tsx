import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ErrorState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Confetti } from '@/components/Confetti';
import { MacroPill } from '@/components/MacroPill';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/Skeleton';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import { WaterBottle } from '@/components/WaterBottle';
import { WeekStrip } from '@/components/WeekStrip';
import { copyDiaryDay } from '@/data/sqlite/repositories/diaryRepository';
import { useAchievements } from '@/features/achievements/useAchievements';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { useMealSuggestions } from '@/features/diary/hooks/useMealSuggestions';
import { useWeekOverview } from '@/features/diary/hooks/useWeekOverview';
import type { MealType } from '@/features/diary/types';
import { addDays } from '@/features/diary/utils/date';
import { currentDefaultMeal } from '@/features/diary/utils/meals';
import {
  describeExtras,
  describeUnknown,
  formatGrams,
  formatPartialAmount,
  remainingCalories,
} from '@/features/diary/utils/totals';
import { foodEmoji } from '@/features/foods/utils/foodEmoji';
import { hapticSelection, hapticSuccess } from '@/features/haptics/haptics';
import { scheduleReminders } from '@/features/reminders/notifications';
import { NEXT_MEAL_LABELS, greetingForHour, greetingLine } from '@/features/home/greeting';
import { buildInsights, type Insight } from '@/features/insights/buildInsights';
import { useCountUp } from '@/features/motion/useCountUp';
import { staggerIn } from '@/features/motion/springs';
import { useDisplayName } from '@/features/profile/hooks/useDisplayName';
import { useWeightLogs } from '@/features/progress/hooks/useWeightLogs';
import { computeChange } from '@/features/progress/utils/trend';
import { useDiaryStats } from '@/features/stats/hooks/useDiaryStats';
import { computeStreak, computeWeekStats } from '@/features/stats/utils/streak';
import { useWaterDay } from '@/features/water/hooks/useWaterDay';
import { useWaterGoal } from '@/features/water/hooks/useWaterGoal';
import {
  gradients,
  radius,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const database = useSQLiteContext();
  const { day, error, loading, localDate, reload, refresh } = useDiaryDay();
  const { stats } = useDiaryStats();
  const water = useWaterDay();
  const { goalMl: waterGoal } = useWaterGoal();
  const { name } = useDisplayName();
  const weight = useWeightLogs();
  const { fresh, markSeen } = useAchievements();
  const [confettiBurst, setConfettiBurst] = useState(0);

  // Celebrate achievements unlocked since the last visit, once.
  useEffect(() => {
    if (fresh.length === 0) return;

    hapticSuccess();
    showToast(
      fresh.length === 1
        ? `¡Logro desbloqueado! ${fresh[0]?.emoji ?? ''} ${fresh[0]?.title ?? ''}`
        : `¡${fresh.length} logros desbloqueados!`,
    );
    void markSeen().then(() => setConfettiBurst((burst) => burst + 1));
  }, [fresh, markSeen, showToast]);

  const now = new Date();
  const hour = now.getHours();
  const nextMeal = currentDefaultMeal(now);
  const suggestions = useMealSuggestions(nextMeal);

  const weekData = useWeekOverview(
    localDate,
    day ? `${day.entries.length}|${day.consumedPartial.caloriesKcal.knownTotal}` : '',
  );

  const streak = useMemo(
    () => computeStreak(stats?.loggedDates ?? [], localDate),
    [stats, localDate],
  );
  const week = useMemo(
    () => computeWeekStats(stats?.week ?? [], localDate),
    [stats, localDate],
  );

  const waterTotal = water.day?.totalMl ?? 0;
  /** Running total, updated at once so two quick taps do not both cross the goal. */
  const waterTotalRef = useRef(waterTotal);
  useEffect(() => {
    waterTotalRef.current = waterTotal;
  }, [waterTotal]);

  const insights = useMemo(
    () =>
      day
        ? buildInsights({
            hour,
            goals: day.goals,
            targets: day.targets,
            consumed: day.consumedPartial,
            mealEntries: {
              breakfast: day.meals.breakfast.entries.length,
              lunch: day.meals.lunch.entries.length,
              snack: day.meals.snack.entries.length,
              dinner: day.meals.dinner.entries.length,
            },
            waterMl: waterTotal,
            waterGoalMl: waterGoal,
            streakDays: streak.current,
          })
        : [],
    [day, hour, waterTotal, waterGoal, streak],
  );

  if (loading) {
    return (
      <Screen>
        <ScreenSkeleton />
      </Screen>
    );
  }

  if (error || !day) {
    return (
      <Screen fab>
        <ErrorState message={error ?? 'No hay datos disponibles.'} onRetry={() => void reload()} />
      </Screen>
    );
  }

  const kcal = day.consumedPartial.caloriesKcal;
  const remaining = remainingCalories(day.goals.caloriesKcal, kcal);
  const unknownCaloriesNotice = describeUnknown(kcal);
  const extras = describeExtras(day.consumedPartial, day.targets, day.entries.length > 0);
  const greeting = greetingForHour(hour);

  const sortedWeights = [...weight.logs].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const latestWeight = sortedWeights[sortedWeights.length - 1] ?? null;
  const previousWeight = sortedWeights[sortedWeights.length - 2] ?? null;
  const weightChange = latestWeight
    ? computeChange(latestWeight.weightKg, previousWeight?.weightKg ?? null)
    : null;

  const openAddFood = (meal: MealType, foodId?: string) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal, ...(foodId ? { foodId } : {}) },
    });
  };

  const handleAddWater = async (amountMl: number) => {
    const previousTotal = waterTotalRef.current;
    waterTotalRef.current = previousTotal + amountMl;
    const added = await water.add(amountMl);
    if (!added) {
      waterTotalRef.current = previousTotal;
    }
    if (added) {
      hapticSuccess();
      if (previousTotal < waterGoal && previousTotal + amountMl >= waterGoal) {
        showToast('¡Objetivo de agua conseguido!');
      }
    } else {
      showToast('No se ha podido registrar el agua.', 'error');
    }
  };

  const handleRepeatYesterday = async () => {
    try {
      const count = await copyDiaryDay(database, addDays(localDate, -1), localDate, nextMeal);
      if (count === 0) {
        showToast('Ayer no registraste esta comida.', 'error');
        return;
      }
      await refresh();
      void scheduleReminders(database);
      hapticSuccess();
      showToast(`Añadido lo de ayer (${count}).`);
    } catch {
      showToast('No se ha podido copiar la comida de ayer.', 'error');
    }
  };

  const nextMealInfo = NEXT_MEAL_LABELS[nextMeal];
  const nextMealEmpty = day.meals[nextMeal].entries.length === 0;

  return (
    <>
    <Screen fab>
      <Animated.View entering={staggerIn(0)} style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            {greetingLine(hour, name)} {greeting.emoji}
          </Text>
          <Text style={styles.subtitle}>Esto es lo que llevas hoy</Text>
        </View>
        <View
          accessibilityLabel={`Racha de ${streak.current} días`}
          style={styles.streakChip}
        >
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakNumber}>{streak.current}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={staggerIn(1)}>
        <Card variant="hero">
          <View style={styles.heroRow}>
            <ProgressRing
              accessibilityLabel={`${formatPartialAmount(kcal)} de ${day.goals.caloriesKcal} kilocalorías`}
              gradient={gradients.accent}
              maximum={day.goals.caloriesKcal}
              size={148}
              strokeWidth={14}
              value={kcal.knownTotal}
            >
              <AnimatedNumber
                color={colors.onHero}
                prefix={remaining.approximate ? (remaining.over ? '≥ ' : '≤ ') : ''}
                style={styles.ringValue}
                value={remaining.amount}
              />
              <Text style={styles.ringLabel}>{remaining.over ? 'de más' : 'restantes'}</Text>
            </ProgressRing>

            <View style={styles.heroMain}>
              <Text style={styles.heroLabel}>HAS COMIDO</Text>
              <AnimatedNumber
                color={colors.onHero}
                prefix={kcal.complete ? '' : '≥ '}
                style={styles.heroValue}
                value={kcal.knownTotal}
              />
              <Text style={styles.heroGoal}>de {Math.round(day.goals.caloriesKcal)} kcal</Text>
            </View>
          </View>

          {unknownCaloriesNotice ? (
            <Text style={styles.heroNotice}>
              {unknownCaloriesNotice}. Completa sus datos para ver el total real.
            </Text>
          ) : null}
          {day.goalsAreDefault ? (
            <Text style={styles.heroNotice}>
              Objetivos provisionales: no calculados con tus datos personales.
            </Text>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={staggerIn(2)}>
        <Card>
          <SectionHeader title="Macronutrientes" />
          <View style={styles.pills}>
            <MacroPill
              approximate={!day.consumedPartial.proteinGrams.complete}
              color={colors.protein}
              goal={day.goals.proteinGrams}
              label="Proteínas"
              tint={colors.proteinLight}
              value={day.consumedPartial.proteinGrams.knownTotal}
            />
            <MacroPill
              approximate={!day.consumedPartial.carbohydrateGrams.complete}
              color={colors.carbohydrates}
              goal={day.goals.carbohydrateGrams}
              label="Hidratos"
              tint={colors.carbohydratesLight}
              value={day.consumedPartial.carbohydrateGrams.knownTotal}
            />
            <MacroPill
              approximate={!day.consumedPartial.fatGrams.complete}
              color={colors.fat}
              goal={day.goals.fatGrams}
              label="Grasas"
              tint={colors.fatLight}
              value={day.consumedPartial.fatGrams.knownTotal}
            />
          </View>
          {extras.length > 0 ? (
            <View style={styles.extras}>
              {extras.map((extra) => (
                <View
                  key={extra.key}
                  accessibilityLabel={`${extra.label}: ${extra.amount} gramos, ${extra.target}`}
                  style={styles.extra}
                >
                  <Text style={styles.extraLabel}>{extra.label}</Text>
                  <Text style={[styles.extraValue, extra.exceeded && styles.extraExceeded]}>
                    {extra.amount} g
                  </Text>
                  <Text style={styles.extraTarget}>{extra.target}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={staggerIn(3)}>
        <Card>
          <WeekStrip
            data={weekData}
            goalKcal={day.goals.caloriesKcal}
            onSelect={(date) =>
              router.push({ pathname: '/(tabs)/diary', params: { date, t: String(Date.now()) } })
            }
            selectedDate={localDate}
            showHeader={false}
          />
          <Text style={styles.weekCaption}>
            {week.averageKcal !== null
              ? `${week.loggedDays}/7 días registrados · media de ${week.averageKcal} kcal`
              : 'Aún no hay registros esta semana'}
          </Text>
          <View style={styles.weekActions}>
            <Chip emoji="📊" label="Resumen semanal" onPress={() => router.push('/summary')} />
          </View>
        </Card>
      </Animated.View>

      {insights.map((insight, index) => (
        <Animated.View key={insight.kind} entering={staggerIn(4 + index)}>
          <InsightCard insight={insight} />
        </Animated.View>
      ))}

      <Animated.View entering={staggerIn(4 + insights.length)}>
        <Card>
          <SectionHeader
            caption={nextMealEmpty ? 'Un toque y listo' : 'Ya tienes algo registrado'}
            title={`${nextMealInfo.emoji} Siguiente: ${nextMealInfo.label}`}
          />
          <View style={styles.suggestions}>
            {suggestions.map((food) => (
              <Chip
                key={food.id}
                emoji={foodEmoji(food.name)}
                label={food.name}
                onPress={() => openAddFood(nextMeal, food.id)}
              />
            ))}
            <Chip emoji="➕" label="Buscar" onPress={() => openAddFood(nextMeal)} />
            {nextMealEmpty ? (
              <Chip emoji="🔁" label="Repetir ayer" onPress={() => void handleRepeatYesterday()} />
            ) : null}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={staggerIn(5 + insights.length)} style={styles.bento}>
        <Card style={styles.waterTile}>
          <Text style={styles.tileTitle}>Agua</Text>
          <View style={styles.waterBody}>
            <WaterBottle goalMl={waterGoal} valueMl={waterTotal} width={46} />
            <View style={styles.waterInfo}>
              <Text style={styles.waterAmount}>{formatLiters(waterTotal)}</Text>
              <Text style={styles.tileCaption}>de {formatLiters(waterGoal)}</Text>
            </View>
          </View>
          <View style={styles.waterButtons}>
            <Chip label="+250" onPress={() => void handleAddWater(250)} />
            <Chip label="+500" onPress={() => void handleAddWater(500)} />
          </View>
        </Card>

        <View style={styles.tileColumn}>
          <Card style={styles.smallTile}>
            <Text style={styles.tileEmoji}>🔥</Text>
            <Text style={styles.tileValue}>
              {streak.current} {streak.current === 1 ? 'día' : 'días'}
            </Text>
            <Text style={styles.tileCaption}>
              {streak.best > 0 ? `Mejor racha: ${streak.best}` : 'Registra hoy para empezar'}
            </Text>
          </Card>

          <AnimatedPressable
            accessibilityLabel="Ver progreso de peso"
            accessibilityRole="button"
            haptic
            onPress={() => router.push('/(tabs)/progress')}
          >
            <Card style={styles.smallTile}>
              <Text style={styles.tileEmoji}>⚖️</Text>
              <Text style={styles.tileValue}>
                {latestWeight ? `${latestWeight.weightKg.toFixed(1)} kg` : '— kg'}
              </Text>
              <Text style={styles.tileCaption}>
                {weightChange === null
                  ? 'Registra tu peso'
                  : `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg vs anterior`}
              </Text>
            </Card>
          </AnimatedPressable>
        </View>
      </Animated.View>

      <Animated.View entering={staggerIn(6 + insights.length)}>
        <Card>
          <SectionHeader
            actionLabel="Ver diario"
            caption="Toca una comida para añadir"
            title="Comidas de hoy"
            onAction={() => router.push('/(tabs)/diary')}
          />
          <MealList
            meals={day.meals}
            onMealPress={(meal) => {
              hapticSelection();
              openAddFood(meal);
            }}
          />
        </Card>
      </Animated.View>
    </Screen>
    <Confetti burst={confettiBurst} />
    </>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const background =
    insight.tone === 'success'
      ? colors.primaryLight
      : insight.tone === 'warning'
        ? colors.carbohydratesLight
        : colors.surfaceMuted;

  return (
    <View
      accessibilityLabel={`${insight.title}. ${insight.message}`}
      style={[styles.insight, { backgroundColor: background }]}
    >
      <Text style={styles.insightEmoji}>{insight.emoji}</Text>
      <View style={styles.insightText}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <Text style={styles.insightMessage}>{insight.message}</Text>
      </View>
    </View>
  );
}

function AnimatedNumber({
  value,
  color,
  style,
  prefix = '',
}: {
  value: number | null;
  color: string;
  style?: object;
  prefix?: string;
}) {
  const display = useCountUp(value ?? 0, 600, 0);
  return (
    <Text style={[style, { color }]}>{value === null ? '—' : `${prefix}${String(display)}`}</Text>
  );
}

/** 1500 → "1,5 L"; under a litre, "750 ml". */
function formatLiters(ml: number): string {
  return ml >= 1000 ? `${formatGrams(ml / 1000)} L` : `${Math.round(ml)} ml`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    greeting: {
      ...typography.headline,
      color: colors.text,
    },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    streakChip: {
      alignItems: 'center',
      backgroundColor: colors.carbohydratesLight,
      borderRadius: radius.pill,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    streakEmoji: {
      fontSize: 18,
    },
    streakNumber: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
    },
    heroRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xl,
    },
    ringValue: {
      ...typography.display,
      ...tabularNumbers,
      fontSize: 34,
    },
    ringLabel: {
      ...typography.caption,
      color: colors.onHero,
      opacity: 0.85,
    },
    heroMain: {
      flex: 1,
      gap: 2,
    },
    heroLabel: {
      ...typography.label,
      color: colors.onHero,
      opacity: 0.8,
    },
    heroValue: {
      ...typography.displayLarge,
      ...tabularNumbers,
    },
    heroGoal: {
      ...typography.body,
      color: colors.onHero,
      opacity: 0.85,
    },
    heroNotice: {
      ...typography.caption,
      color: colors.onHero,
      fontSize: 12,
      lineHeight: 17,
      opacity: 0.85,
    },
    pills: {
      gap: spacing.sm,
    },
    extras: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    extra: {
      flex: 1,
      gap: 2,
    },
    extraLabel: {
      ...typography.label,
      color: colors.textMuted,
    },
    extraValue: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
      fontSize: 16,
    },
    extraExceeded: {
      color: colors.warning,
    },
    extraTarget: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 11,
    },
    weekActions: {
      alignItems: 'center',
    },
    weekCaption: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    insight: {
      alignItems: 'center',
      borderRadius: radius.lg,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
    },
    insightEmoji: {
      fontSize: 28,
    },
    insightText: {
      flex: 1,
      gap: 2,
    },
    insightTitle: {
      ...typography.title,
      color: colors.text,
      fontSize: 16,
    },
    insightMessage: {
      ...typography.body,
      color: colors.text,
      fontSize: 14,
    },
    suggestions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    bento: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    waterTile: {
      flex: 1.15,
      gap: spacing.md,
    },
    waterBody: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    waterInfo: {
      flex: 1,
      gap: 2,
    },
    waterAmount: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.water,
      fontSize: 22,
    },
    waterButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tileColumn: {
      flex: 1,
      gap: spacing.md,
    },
    smallTile: {
      flex: 1,
      gap: spacing.xs,
      padding: spacing.lg,
    },
    tileTitle: {
      ...typography.title,
      color: colors.text,
    },
    tileEmoji: {
      fontSize: 22,
    },
    tileValue: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
    },
    tileCaption: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 12,
    },
  });
}

