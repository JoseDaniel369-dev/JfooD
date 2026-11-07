import { StyleSheet, Text, View } from 'react-native';

import type { NutritionGoals } from '@jfood/core';

import { Card } from '@/components/Card';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { colors, radius, spacing, typography } from '@/theme';

export default function ProfileScreen() {
  const { error, goals, load, loading, profile, saving, update } = useProfile();

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Perfil y objetivos"
        subtitle="Calculados a partir de tus datos, sin crear una cuenta"
      />

      {error && !profile ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {error && profile ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {goals ? <GoalsSummary goals={goals} /> : null}

      <ProfileForm
        initial={profile}
        onSubmit={(data) => void update(data)}
        saving={saving}
      />

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Tus objetivos se recalcularán con la ecuación de Mifflin-St Jeor
          usando tu peso, altura, edad, sexo y nivel de actividad.
        </Text>
      </View>
    </Screen>
  );
}

function GoalsSummary({ goals }: { goals: NutritionGoals }) {
  return (
    <Card style={styles.goalsCard}>
      <Text style={styles.goalsTitle}>Tus objetivos diarios</Text>
      <View style={styles.goalsRow}>
        <GoalItem
          color={colors.primary}
          label="Calorías"
          unit="kcal"
          value={goals.caloriesKcal}
        />
        <GoalItem
          color={colors.protein}
          label="Proteínas"
          unit="g"
          value={goals.proteinGrams}
        />
        <GoalItem
          color={colors.carbohydrates}
          label="Carbos"
          unit="g"
          value={goals.carbohydrateGrams}
        />
        <GoalItem
          color={colors.fat}
          label="Grasas"
          unit="g"
          value={goals.fatGrams}
        />
      </View>
    </Card>
  );
}

function GoalItem({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.goalItem}>
      <View style={[styles.goalDot, { backgroundColor: color }]} />
      <Text style={styles.goalLabel}>{label}</Text>
      <Text style={styles.goalValue}>
        {Math.round(value)}
        <Text style={styles.goalUnit}> {unit}</Text>
      </Text>
    </View>
  );
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
    lineHeight: 20,
    textAlign: 'center',
  },
  goalsCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  goalsTitle: {
    color: colors.textOnPrimary,
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    letterSpacing: typography.label.letterSpacing,
    opacity: 0.75,
  },
  goalsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  goalItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  goalDot: {
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  goalLabel: {
    color: colors.textOnPrimary,
    fontSize: 12,
    opacity: 0.75,
  },
  goalValue: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  goalUnit: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
  },
  notice: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
