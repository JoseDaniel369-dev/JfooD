import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { NutritionGoals } from '@jfood/core';

import { Card } from '@/components/Card';
import { useCountUp } from '@/features/motion/useCountUp';
import {
  fonts,
  fontSizes,
  onHeroTrack,
  radius,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

interface GoalsSummaryProps {
  goals: NutritionGoals;
  /** "Objetivo: perder 0,5 kg por semana", when there is one. */
  goalText?: string | null;
}

/** The daily goals (calories and macros) on the hero gradient: Profile and the end of the onboarding. */
export function GoalsSummary({ goals, goalText }: GoalsSummaryProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const calories = useCountUp(Math.round(goals.caloriesKcal), 800, 0);

  return (
    <Card variant="hero">
      <View accessible accessibilityLabel={`Objetivo diario: ${Math.round(goals.caloriesKcal)} kilocalorías`}>
        <Text style={styles.label}>TUS OBJETIVOS DIARIOS</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.calories}>
          {calories}
          <Text style={styles.unit}> kcal</Text>
        </Text>
        {goalText ? <Text style={styles.goalText}>{goalText}</Text> : null}
      </View>
      <View style={styles.row}>
        <MacroGoal color={colors.protein} label="Proteínas" value={goals.proteinGrams} />
        <MacroGoal color={colors.carbohydrates} label="Hidratos" value={goals.carbohydrateGrams} />
        <MacroGoal color={colors.fat} label="Grasas" value={goals.fatGrams} />
      </View>
    </Card>
  );
}

function MacroGoal({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View accessible accessibilityLabel={`${label}: ${Math.round(value)} gramos`} style={styles.macro}>
      <View style={styles.macroHeader}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text maxFontSizeMultiplier={1.2} style={styles.macroLabel}>
          {label}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.macroValue}>
        {Math.round(value)}
        <Text style={styles.macroUnit}> g</Text>
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      ...typography.label,
      color: colors.onHeroMuted,
    },
    calories: {
      ...typography.display,
      ...tabularNumbers,
      color: colors.onHero,
    },
    unit: {
      ...typography.body,
      color: colors.onHeroMuted,
    },
    goalText: {
      ...typography.caption,
      color: colors.onHeroMuted,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    macro: {
      backgroundColor: onHeroTrack,
      borderRadius: radius.md,
      flex: 1,
      gap: 2,
      padding: spacing.md,
    },
    macroHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    dot: {
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    macroLabel: {
      ...typography.micro,
      color: colors.onHeroMuted,
    },
    macroValue: {
      color: colors.onHero,
      fontFamily: fonts.heading,
      fontSize: fontSizes.bodyLarge,
      ...tabularNumbers,
    },
    macroUnit: {
      ...typography.caption,
      color: colors.onHeroMuted,
    },
  });
}
