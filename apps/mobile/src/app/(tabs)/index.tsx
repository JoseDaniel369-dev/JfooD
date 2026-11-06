import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { formatLocalDate } from '@/features/diary/utils/date';
import { colors, radius, spacing } from '@/theme';

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

      <View style={styles.welcome}>
        <Text style={styles.title}>Tu día, de un vistazo.</Text>
        <Text style={styles.subtitle}>Nutrición sencilla, datos bajo tu control.</Text>
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
          maximum={day.goals.caloriesKcal}
          trackColor="rgba(255,255,255,0.18)"
          value={consumedCalories}
          color={colors.accent}
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
        <Text style={styles.sectionTitle}>Macronutrientes</Text>
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

      <Pressable
        accessibilityLabel="Abrir escáner de alimentos"
        accessibilityRole="button"
        onPress={() => router.push('/scanner')}
        style={({ pressed }) => [styles.scannerButton, pressed && styles.pressed]}
      >
        <View style={styles.scannerIcon}>
          <Ionicons color={colors.primary} name="camera-outline" size={26} />
        </View>
        <View style={styles.scannerCopy}>
          <Text style={styles.scannerTitle}>Escanear una comida</Text>
          <Text style={styles.scannerSubtitle}>Fotografía y revisión asistida</Text>
        </View>
        <Ionicons color={colors.primary} name="arrow-forward" size={21} />
      </Pressable>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Comidas de hoy</Text>
          <Text style={styles.sectionCaption}>Resumen diario</Text>
        </View>
        <MealList meals={day.meals} />
      </Card>
    </Screen>
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
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  welcome: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
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
    fontWeight: '600',
  },
  goalNotice: {
    color: colors.textOnPrimary,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.7,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCaption: {
    color: colors.textMuted,
    fontSize: 11,
  },
  scannerButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  scannerIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  scannerCopy: {
    flex: 1,
    gap: 3,
  },
  scannerTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  scannerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
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
    color: colors.text,
    fontSize: 14,
  },
  macroValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  macroGoal: {
    color: colors.textMuted,
    fontWeight: '400',
  },
});
