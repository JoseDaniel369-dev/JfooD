import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Fab } from '@/components/Fab';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import { isScannerEnabled } from '@/config/api';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { formatLocalDate } from '@/features/diary/utils/date';
import { currentDefaultMeal } from '@/features/diary/utils/meals';
import {
  describeUnknown,
  formatPartialAmount,
  formatRemaining,
  remainingCalories,
  remainingLabel,
} from '@/features/diary/utils/totals';
import { hapticSelection, hapticSuccess } from '@/features/haptics/haptics';
import { durations, easings } from '@/features/motion/motion';
import { useCountUp } from '@/features/motion/useCountUp';
import { useDiaryStats } from '@/features/stats/hooks/useDiaryStats';
import { StreakRing } from '@/features/stats/components/StreakRing';
import { computeStreak, computeWeekStats } from '@/features/stats/utils/streak';
import { useWaterDay } from '@/features/water/hooks/useWaterDay';
import { useWaterGoal } from '@/features/water/hooks/useWaterGoal';
import {
  fonts,
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';
import type { PartialNutrient } from '@jfood/core';
import type { MealType } from '@/features/diary/types';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const BAR_HEIGHT = 72;

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const { day, error, loading, localDate, reload } = useDiaryDay();
  const { stats, error: statsError } = useDiaryStats();
  const water = useWaterDay();
  const waterError = water.error;
  const { goalMl: waterGoal } = useWaterGoal();

  const streak = useMemo(() => {
    const dates = stats?.loggedDates ?? [];
    return computeStreak(dates, localDate);
  }, [stats, localDate]);

  const week = useMemo(() => {
    return computeWeekStats(stats?.week ?? [], localDate);
  }, [stats, localDate]);

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !day) {
    return (
      <Screen fab>
        <ErrorState
          message={error ?? 'No hay datos disponibles.'}
          onRetry={() => void reload()}
        />
      </Screen>
    );
  }

  const kcal = day.consumedPartial.caloriesKcal;
  const remaining = remainingCalories(day.goals.caloriesKcal, kcal);
  const unknownCaloriesNotice = describeUnknown(kcal);

  const handleMealPress = (mealType: MealType) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: mealType },
    });
  };

  const handleAddWater = async (amountMl: number) => {
    const previousTotal = water.day?.totalMl ?? 0;
    const added = await water.add(amountMl);
    if (added) {
      hapticSuccess();
      if (previousTotal < waterGoal && previousTotal + amountMl >= waterGoal) {
        showToast('¡Objetivo de agua conseguido!');
      }
    } else {
      showToast('No se ha podido registrar el agua.', 'error');
    }
  };

  const handleFabPress = () => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: currentDefaultMeal() },
    });
  };

  return (
    <Screen fab>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons color={colors.textOnPrimary} name="leaf" size={21} />
          </View>
          <Text style={styles.brand}>JfooD</Text>
        </View>
        <Text style={styles.date}>{formatLocalDate(localDate)}</Text>
      </View>

      <Card animated delay={0} variant="hero">
        <View style={styles.heroRow}>
          <View style={styles.heroMain}>
            <Text style={styles.cardLabel}>CALORÍAS DE HOY</Text>
            <View style={styles.calorieNumbers}>
              <AnimatedNumber
                color={colors.onHero}
                decimals={0}
                prefix={kcal.complete ? '' : '≥ '}
                style={styles.calorieValue}
                value={kcal.knownTotal}
              />
              <Text style={styles.calorieGoal}>
                / {formatNumber(day.goals.caloriesKcal)} kcal
              </Text>
            </View>
            <View style={styles.calorieFooter}>
              <Text style={styles.calorieFooterLabel}>
                {remainingLabel(remaining)}
              </Text>
              <Text style={styles.calorieFooterValue}>
                {formatRemaining(remaining)}
              </Text>
            </View>
          </View>

          <View style={styles.streakColumn}>
            <StreakRing maximum={7} size={92} strokeWidth={9} value={streak.current}>
              <View style={styles.streakCenter}>
                <Ionicons color={colors.accent} name="flame" size={18} />
                <AnimatedNumber
                  color={colors.onHero}
                  style={styles.streakValue}
                  value={streak.current}
                />
                <Text style={styles.streakLabel}>días</Text>
              </View>
            </StreakRing>
            <Text style={styles.streakHint}>
              {streak.best > 0 ? `Mejor: ${streak.best}` : 'Tu racha'}
            </Text>
          </View>
        </View>

        <ProgressBar
          color={colors.accent}
          maximum={day.goals.caloriesKcal}
          trackColor="rgba(255,255,255,0.18)"
          value={kcal.knownTotal}
        />

        {unknownCaloriesNotice ? (
          <Text style={styles.goalNotice}>
            {unknownCaloriesNotice}. Completa sus datos para ver el total real.
          </Text>
        ) : null}

        {day.goalsAreDefault ? (
          <Text style={styles.goalNotice}>
            Objetivos provisionales: no calculados con tus datos personales.
          </Text>
        ) : null}
      </Card>

      <Card animated delay={50}>
        <SectionHeader
          title="Esta semana"
          caption={
            statsError
              ? 'No se han podido cargar las estadísticas'
              : week.averageKcal !== null
                ? `${week.loggedDays}/7 días · ${week.averageKcal} kcal de media`
                : 'Sin registros aún'
          }
        />
        <WeekBars days={week.days} />
        {week.days.some((day) => day.partial || (day.logged && day.caloriesKcal === null)) ? (
          <Text style={styles.weekLegend}>
            Barras naranjas: días con alimentos sin calorías (valor mínimo).
          </Text>
        ) : null}
      </Card>

      <Card animated delay={100}>
        <SectionHeader title="Macronutrientes" />
        <MacroRow
          color={colors.protein}
          consumed={day.consumedPartial.proteinGrams}
          goal={day.goals.proteinGrams}
          label="Proteínas"
        />
        <MacroRow
          color={colors.carbohydrates}
          consumed={day.consumedPartial.carbohydrateGrams}
          goal={day.goals.carbohydrateGrams}
          label="Carbohidratos"
        />
        <MacroRow
          color={colors.fat}
          consumed={day.consumedPartial.fatGrams}
          goal={day.goals.fatGrams}
          label="Grasas"
        />
      </Card>

      <Card animated delay={150}>
        <SectionHeader
          title="Agua"
          caption={
            waterError
              ? 'No se ha podido cargar el agua'
              : water.day
                ? `${formatNumber(water.day.totalMl)} / ${waterGoal} ml`
                : undefined
          }
        />
        <ProgressBar
          color={colors.water}
          maximum={waterGoal}
          value={water.day?.totalMl ?? 0}
        />
        <View style={styles.waterButtons}>
          <ButtonChip
            icon="add"
            label="+250 ml"
            onPress={() => void handleAddWater(250)}
          />
          <ButtonChip
            icon="add"
            label="+500 ml"
            onPress={() => void handleAddWater(500)}
          />
        </View>
      </Card>

      <Card animated delay={200}>
        <SectionHeader title="Accesos rápidos" />
        <View style={styles.shortcuts}>
          <ShortcutButton
            icon="scale-outline"
            label="Peso"
            onPress={() => router.push('/(tabs)/progress')}
          />
          <ShortcutButton
            icon="calendar-outline"
            label="Planificar"
            onPress={() => router.push('/(tabs)/planner')}
          />
          {isScannerEnabled() ? (
            <ShortcutButton
              icon="camera-outline"
              label="Escanear"
              onPress={() => router.push('/scanner')}
            />
          ) : null}
        </View>
      </Card>

      <Card animated delay={250}>
        <SectionHeader
          actionLabel="Ver diario"
          caption="Toca una comida para añadir"
          title="Comidas de hoy"
          onAction={() => router.push('/(tabs)/diary')}
        />
        <MealList meals={day.meals} onMealPress={handleMealPress} />
      </Card>

      <Fab accessibilityLabel="Añadir comida" onPress={handleFabPress} />
    </Screen>
  );
}

function AnimatedNumber({
  value,
  color,
  style,
  decimals = 0,
  prefix = '',
}: {
  value: number | null;
  color: string;
  style?: object;
  decimals?: number;
  prefix?: string;
}) {
  const display = useCountUp(value ?? 0, 600, decimals);
  return (
    <Text style={[style, { color }]}>
      {value === null ? '—' : `${prefix}${String(display)}`}
    </Text>
  );
}

function ButtonChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={({ pressed }) => [styles.waterButton, pressed && styles.pressed]}
    >
      <Ionicons color={colors.water} name={icon} size={18} />
      <Text style={styles.waterButtonText}>{label}</Text>
    </Pressable>
  );
}

function WeekBars({
  days,
}: {
  days: {
    localDate: string;
    caloriesKcal: number | null;
    partial?: boolean;
    logged?: boolean;
  }[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const values = days.map((day) => day.caloriesKcal ?? 0);
  const max = Math.max(...values, 1);

  return (
    <View style={styles.weekBars}>
      {days.map((day, index) => {
        const targetHeight =
          day.caloriesKcal === null
            ? day.logged
              ? 10
              : 4
            : Math.max((day.caloriesKcal / max) * BAR_HEIGHT, 10);
        const label = day.localDate.split('-')[2] ?? '';

        return (
          <View key={day.localDate} style={styles.weekBarColumn}>
            <Svg height={BAR_HEIGHT} width={18}>
              <AnimatedBar
                color={day.partial || (day.logged && day.caloriesKcal === null) ? colors.accent : colors.primary}
                height={targetHeight}
                opacity={day.logged ? (day.partial || day.caloriesKcal === null ? 0.7 : 1) : 0.25}
              />
            </Svg>
            <Text style={styles.weekBarLabel}>
              {index === days.length - 1 ? 'Hoy' : label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function AnimatedBar({
  color,
  height,
  opacity,
}: {
  color: string;
  height: number;
  opacity: number;
}) {
  const [heightAnim] = useState(() => new Animated.Value(4));
  const [yAnim] = useState(() => new Animated.Value(BAR_HEIGHT - 4));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: height,
        duration: durations.slow,
        useNativeDriver: false,
        easing: (x) => easings.easeOutCubic(x),
      }),
      Animated.timing(yAnim, {
        toValue: BAR_HEIGHT - height,
        duration: durations.slow,
        useNativeDriver: false,
        easing: (x) => easings.easeOutCubic(x),
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [heightAnim, yAnim, height]);

  return (
    <AnimatedRect
      fill={color}
      height={heightAnim}
      opacity={opacity}
      rx={6}
      width={18}
      x={0}
      y={yAnim}
    />
  );
}

function ShortcutButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
    >
      <View style={styles.shortcutIcon}>
        <Ionicons color={colors.primary} name={icon} size={22} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

interface MacroRowProps {
  label: string;
  consumed: PartialNutrient;
  goal: number;
  color: string;
}

function MacroRow({ label, consumed, goal, color }: MacroRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <View style={styles.macroLabelRow}>
          <View style={[styles.macroDot, { backgroundColor: color }]} />
          <Text style={styles.macroLabel}>{label}</Text>
        </View>
        <Text style={styles.macroValue}>
          {formatPartialAmount(consumed)}{' '}
          <Text style={styles.macroGoal}>/ {goal} g</Text>
        </Text>
      </View>
      <ProgressBar color={color} maximum={goal} value={consumed.knownTotal} />
    </View>
  );
}

function formatNumber(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      gap: spacing.md,
    },
    brandRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    brandIcon: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    brand: {
      color: colors.primary,
      fontFamily: fonts.brand,
      fontSize: 24,
      letterSpacing: -0.8,
    },
    date: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    heroRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.lg,
      justifyContent: 'space-between',
    },
    heroMain: {
      flex: 1,
      gap: spacing.xs,
    },
    cardLabel: {
      color: colors.onHero,
      fontSize: typography.label.fontSize,
      fontWeight: '700',
      letterSpacing: typography.label.letterSpacing,
      opacity: 0.75,
    },
    calorieNumbers: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    calorieValue: {
      fontSize: 44,
      fontWeight: '700',
      letterSpacing: -1.5,
    },
    calorieGoal: {
      color: colors.onHero,
      fontSize: 15,
      opacity: 0.7,
    },
    calorieFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    calorieFooterLabel: {
      color: colors.onHero,
      fontSize: 13,
      opacity: 0.75,
    },
    calorieFooterValue: {
      color: colors.onHero,
      fontSize: 14,
      fontWeight: '700',
    },
    goalNotice: {
      color: colors.onHero,
      fontSize: 11,
      lineHeight: 16,
      opacity: 0.7,
    },
    streakColumn: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    streakCenter: {
      alignItems: 'center',
    },
    streakValue: {
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 26,
    },
    streakLabel: {
      color: colors.onHero,
      fontSize: 11,
      opacity: 0.75,
    },
    streakHint: {
      color: colors.onHero,
      fontSize: 11,
      opacity: 0.75,
    },
    weekBars: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    weekBarColumn: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    weekLegend: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 11,
    },
    weekBarLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 10,
    },
    waterButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    waterButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
      minHeight: 48,
      padding: spacing.md,
    },
    waterButtonText: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    shortcuts: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    shortcut: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      flex: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    shortcutIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    shortcutLabel: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '700',
    },
    macroRow: {
      gap: spacing.sm,
    },
    macroHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    macroLabelRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    macroDot: {
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    macroLabel: {
      ...typography.body,
      color: colors.text,
    },
    macroValue: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    macroGoal: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: '400',
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
