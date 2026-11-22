import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ErrorState } from '@/components/AsyncState';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Confetti } from '@/components/Confetti';
import { CalorieHero } from '@/components/CalorieHero';
import { MacroPill } from '@/components/MacroPill';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/Skeleton';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
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
  formatGrams,
} from '@/features/diary/utils/totals';
import { foodEmoji } from '@/features/foods/utils/foodEmoji';
import { hapticSelection, hapticSuccess } from '@/features/haptics/haptics';
import { scheduleReminders } from '@/features/reminders/notifications';
import { NEXT_MEAL_LABELS, greetingLine } from '@/features/home/greeting';
import { buildInsights } from '@/features/insights/buildInsights';
import { InsightCarousel } from '@/features/insights/components/InsightCarousel';
import { staggerIn } from '@/features/motion/springs';
import { useDisplayName } from '@/features/profile/hooks/useDisplayName';
import { useWeightLogs } from '@/features/progress/hooks/useWeightLogs';
import { computeChange } from '@/features/progress/utils/trend';
import { useDiaryStats } from '@/features/stats/hooks/useDiaryStats';
import { computeStreak, computeWeekStats } from '@/features/stats/utils/streak';
import { useWaterDay } from '@/features/water/hooks/useWaterDay';
import { useWaterGoal } from '@/features/water/hooks/useWaterGoal';
import { WATER_EXTRA_PRESETS, parseWaterAmount } from '@/features/water/utils/goal';
import {
  radius,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
  type ThemeColors,
  fontSizes,
  fonts,
} from '@/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const database = useSQLiteContext();
  const { day, error, loading, localDate, reload, refresh } = useDiaryDay();
  const { stats, reload: reloadStats } = useDiaryStats();
  const water = useWaterDay();
  const { goalMl: waterGoal } = useWaterGoal();
  const { name } = useDisplayName();
  const weight = useWeightLogs();
  const { fresh, markSeen, reload: reloadAchievements } = useAchievements();
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [customWater, setCustomWater] = useState<string | null>(null);
  const [customWaterError, setCustomWaterError] = useState<string | null>(null);
  /** Set at once: two quick taps on "Añadir" must log once. */
  const addingCustomRef = useRef(false);
  /** Set at once: two quick taps on "Repetir ayer" must copy once. */
  const repeatingRef = useRef(false);

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
  const extras = describeExtras(day.consumedPartial, day.targets, day.entries.length > 0);

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

  const handleAddCustomWater = async () => {
    if (addingCustomRef.current) return;
    const amount = parseWaterAmount(customWater ?? '');
    if (amount === null) {
      setCustomWaterError('Escribe una cantidad entre 1 y 5000 ml.');
      return;
    }
    addingCustomRef.current = true;
    try {
      if (await handleAddWater(amount)) {
        setCustomWater(null);
      } else {
        setCustomWaterError('No se ha podido registrar el agua. Inténtalo de nuevo.');
      }
    } finally {
      addingCustomRef.current = false;
    }
  };

  const handleAddWater = async (amountMl: number): Promise<boolean> => {
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
        // Reaching the goal can unlock a "water" achievement.
        void reloadAchievements();
      }
    } else {
      showToast('No se ha podido registrar el agua.', 'error');
    }
    return added;
  };

  const handleRepeatYesterday = async () => {
    if (repeatingRef.current) return;
    repeatingRef.current = true;
    try {
      const count = await copyDiaryDay(database, addDays(localDate, -1), localDate, nextMeal);
      if (count === 0) {
        showToast('Ayer no registraste esta comida.', 'error');
        return;
      }
      await refresh();
      // Streak, weekly average and achievements depend on what was just logged.
      void reloadStats();
      void reloadAchievements();
      void scheduleReminders(database);
      hapticSuccess();
      showToast(`Añadido lo de ayer (${count}).`);
    } catch {
      showToast('No se ha podido copiar la comida de ayer.', 'error');
    } finally {
      repeatingRef.current = false;
    }
  };

  const nextMealInfo = NEXT_MEAL_LABELS[nextMeal];
  const nextMealEmpty = day.meals[nextMeal].entries.length === 0;

  return (
    <>
    <Screen fab>
      <Animated.View entering={staggerIn(0)} style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greetingLine(hour, name)}</Text>
          <Text style={styles.subtitle}>Esto es lo que llevas hoy</Text>
        </View>
        <View
          accessibilityLabel={`Racha de ${streak.current} días`}
          style={styles.streakChip}
        >
          <Ionicons color={colors.accent} name="flame" size={20} />
          <Text style={styles.streakNumber}>{streak.current}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={staggerIn(1)}>
        <CalorieHero
          goalKcal={day.goals.caloriesKcal}
          goalsAreDefault={day.goalsAreDefault}
          kcal={kcal}
        />
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
            <Chip icon="bar-chart-outline" label="Resumen semanal" onPress={() => router.push('/summary')} />
          </View>
        </Card>
      </Animated.View>

      {insights.length > 0 ? (
        <Animated.View entering={staggerIn(4)}>
          <InsightCarousel insights={insights} />
        </Animated.View>
      ) : null}

      <Animated.View entering={staggerIn(5)}>
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
            <Chip icon="search" label="Buscar" onPress={() => openAddFood(nextMeal)} />
            {nextMealEmpty ? (
              <Chip icon="repeat" label="Repetir ayer" onPress={() => void handleRepeatYesterday()} />
            ) : null}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={staggerIn(6)}>
        <Card>
          <View style={styles.waterHeader}>
            <View style={styles.waterBody}>
              <WaterBottle goalMl={waterGoal} valueMl={waterTotal} width={46} />
              <View style={styles.waterInfo}>
                <Text style={styles.tileTitle}>Agua</Text>
                <Text style={styles.waterAmount}>{formatLiters(waterTotal)}</Text>
                <Text style={styles.tileCaption}>de {formatLiters(waterGoal)}</Text>
              </View>
            </View>
            <View style={styles.waterButtons}>
              <Chip label="+250 ml" onPress={() => void handleAddWater(250)} />
              <Chip label="+500 ml" onPress={() => void handleAddWater(500)} />
              <Chip
                accessibilityLabel="Añadir otra cantidad de agua"
                icon="add"
                label="Otra"
                onPress={() => setCustomWater('')}
              />
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={staggerIn(6)} style={styles.tiles}>
        <Card style={styles.smallTile}>
          <Ionicons color={colors.accent} name="flame" size={24} />
          <Text style={styles.tileValue}>
            {streak.best} {streak.best === 1 ? 'día' : 'días'}
          </Text>
          <Text style={styles.tileCaption}>
            {streak.best > 0 ? 'Tu mejor racha' : 'Registra hoy para empezar'}
          </Text>
        </Card>

        <AnimatedPressable
          accessibilityHint="Abre el progreso de peso"
          accessibilityLabel={`Peso: ${latestWeight ? `${latestWeight.weightKg.toFixed(1)} kilos` : 'sin registro'}`}
          accessibilityRole="button"
          haptic
          onPress={() => router.push('/(tabs)/progress')}
          style={styles.tileButton}
        >
          <Card style={styles.smallTile}>
            <View style={styles.tileHeader}>
              <Ionicons color={colors.primary} name="scale-outline" size={24} />
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </View>
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
      </Animated.View>

      <Animated.View entering={staggerIn(7)}>
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
    <BottomSheet
      onClose={() => {
        setCustomWater(null);
        setCustomWaterError(null);
      }}
      title="¿Cuánta agua?"
      visible={customWater !== null}
    >
      <TextField
        accessibilityLabel="Cantidad de agua en mililitros"
        autoFocus
        error={customWaterError}
        inputStyle={styles.waterInput}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={(text) => {
          setCustomWater(text);
          setCustomWaterError(null);
        }}
        onSubmitEditing={() => void handleAddCustomWater()}
        placeholder="ml"
        returnKeyType="done"
        value={customWater ?? ''}
      />
      <View style={styles.waterButtons}>
        {WATER_EXTRA_PRESETS.map((amount) => (
          <Chip key={amount} label={`${amount} ml`} onPress={() => setCustomWater(String(amount))} />
        ))}
      </View>
      <Button title="Añadir" onPress={() => void handleAddCustomWater()} />
    </BottomSheet>
    <Confetti burst={confettiBurst} />
    </>
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
      minHeight: 40,
      paddingHorizontal: spacing.md,
    },
    streakNumber: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
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
      ...typography.bodyStrong,
      ...tabularNumbers,
      color: colors.text,
    },
    extraExceeded: {
      color: colors.warning,
    },
    extraTarget: {
      ...typography.micro,
      color: colors.textMuted,
    },
    weekActions: {
      alignItems: 'center',
    },
    weekCaption: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    suggestions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    waterHeader: {
      gap: spacing.lg,
    },
    waterBody: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.lg,
    },
    waterInfo: {
      flex: 1,
      gap: 2,
    },
    waterAmount: {
      ...typography.headline,
      ...tabularNumbers,
      color: colors.water,
    },
    waterButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    waterInput: {
      fontFamily: fonts.heading,
      fontSize: fontSizes.heading,
      textAlign: 'center',
    },
    tiles: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    tileButton: {
      flex: 1,
    },
    smallTile: {
      flex: 1,
      gap: spacing.xs,
      padding: spacing.lg,
    },
    tileHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tileTitle: {
      ...typography.title,
      color: colors.text,
    },
    tileValue: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
    },
    tileCaption: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
}
