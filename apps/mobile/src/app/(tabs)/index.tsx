import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { formatLocalDate } from '@/features/diary/utils/date';
import { colors, radius, spacing, typography } from '@/theme';
import type { MealType } from '@/features/diary/types';
import { isScannerEnabled } from '@/config/api';

export default function HomeScreen() {
  const { day, error, loading, localDate, reload } = useDiaryDay();

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !day) {
    return (
      <Screen>
        <ErrorState
          message={error ?? 'No hay datos disponibles.'}
          onRetry={() => void reload()}
        />
      </Screen>
    );
  }

  const consumedCalories = day.consumed.caloriesKcal;
  const remainingCalories =
    consumedCalories === null
      ? null
      : day.goals.caloriesKcal - consumedCalories;

  const handleMealPress = (mealType: MealType) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: mealType },
    });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons color={colors.primary} name="leaf" size={21} />
          </View>
          <Text style={styles.brand}>JfooD</Text>
        </View>
        <Text style={styles.date}>{formatLocalDate(localDate)}</Text>
      </View>

      <Card style={styles.calorieCard}>
        <View style={styles.calorieHeader}>
          <Text style={styles.cardLabel}>CALORÍAS DE HOY</Text>
          <Ionicons color={colors.textOnPrimary} name="flame-outline" size={22} />
        </View>
        <View style={styles.calorieNumbers}>
          <Text style={styles.calorieValue}>
            {formatNumber(consumedCalories)}
          </Text>
          <Text style={styles.calorieGoal}>
            / {formatNumber(day.goals.caloriesKcal)} kcal
          </Text>
        </View>
        <ProgressBar
          color={colors.accent}
          maximum={day.goals.caloriesKcal}
          trackColor="rgba(255,255,255,0.18)"
          value={consumedCalories}
        />
        <View style={styles.calorieFooter}>
          <Text style={styles.calorieFooterLabel}>
            {remainingCalories !== null && remainingCalories < 0
              ? 'Por encima del objetivo'
              : 'Restantes'}
          </Text>
          <Text style={styles.calorieFooterValue}>
            {remainingCalories === null
              ? '—'
              : `${formatNumber(Math.abs(remainingCalories))} kcal`}
          </Text>
        </View>
        {day.goalsAreDefault ? (
          <Text style={styles.goalNotice}>
            Objetivos provisionales: no calculados con tus datos personales.
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Macronutrientes" />
        <MacroRow
          color={colors.protein}
          consumed={day.consumed.proteinGrams}
          goal={day.goals.proteinGrams}
          label="Proteínas"
        />
        <MacroRow
          color={colors.carbohydrates}
          consumed={day.consumed.carbohydrateGrams}
          goal={day.goals.carbohydrateGrams}
          label="Carbohidratos"
        />
        <MacroRow
          color={colors.fat}
          consumed={day.consumed.fatGrams}
          goal={day.goals.fatGrams}
          label="Grasas"
        />
      </Card>

      <Card>
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

      <Card>
        <SectionHeader
          actionLabel="Ver diario"
          caption="Toca una comida para añadir"
          title="Comidas de hoy"
          onAction={() => router.push('/(tabs)/diary')}
        />
        <MealList meals={day.meals} onMealPress={handleMealPress} />
      </Card>
    </Screen>
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
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
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
  consumed: number | null;
  goal: number;
  color: string;
}

function MacroRow({ label, consumed, goal, color }: MacroRowProps) {
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <View style={styles.macroLabelRow}>
          <View style={[styles.macroDot, { backgroundColor: color }]} />
          <Text style={styles.macroLabel}>{label}</Text>
        </View>
        <Text style={styles.macroValue}>
          {formatNumber(consumed)} <Text style={styles.macroGoal}>/ {goal} g</Text>
        </Text>
      </View>
      <ProgressBar color={color} maximum={goal} value={consumed} />
    </View>
  );
}

function formatNumber(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brand: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  calorieCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calorieHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLabel: {
    color: colors.textOnPrimary,
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
    color: colors.textOnPrimary,
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  calorieGoal: {
    color: colors.textOnPrimary,
    fontSize: 15,
    opacity: 0.7,
  },
  calorieFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calorieFooterLabel: {
    color: colors.textOnPrimary,
    fontSize: 13,
    opacity: 0.75,
  },
  calorieFooterValue: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  goalNotice: {
    color: colors.textOnPrimary,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.7,
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
