import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NutritionGoals } from '@jfood/core';

import { Card } from '@/components/Card';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import {
  ProfileForm,
  type ProfileSubmitMeta,
} from '@/features/profile/components/ProfileForm';
import { BackupCard } from '@/features/backup/BackupCard';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { hapticSelection, hapticSuccess } from '@/features/haptics/haptics';
import { parseWaterGoal } from '@/features/water/utils/goal';
import { useWaterGoal } from '@/features/water/hooks/useWaterGoal';
import {
  fonts,
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
  type ThemePreference,
} from '@/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', icon: 'contrast-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const { error, goals, load, loading, profile, saving, update } = useProfile();

  const { goalMl: storedWaterGoal, setGoalMl } = useWaterGoal();
  const [waterGoalDraft, setWaterGoalDraft] = useState<string | null>(null);

  const handleSave = async (
    data: Parameters<typeof update>[0],
    meta: ProfileSubmitMeta,
  ) => {
    const result = await update(data, { loadedWeightKg: meta.loadedWeightKg });
    if (result) {
      hapticSuccess();
      showToast('Perfil y objetivos guardados.');
    }
  };

  const handleThemeChange = async (value: ThemePreference) => {
    try {
      await setPreference(value);
    } catch {
      showToast('No se ha podido guardar el tema.', 'error');
    }
  };

  const handleWaterGoalChange = async () => {
    const parsed = parseWaterGoal(waterGoalDraft ?? String(storedWaterGoal));
    if (parsed === null) {
      showToast('Introduce un objetivo de agua válido.', 'error');
      return;
    }

    const saved = await setGoalMl(parsed);
    if (saved) {
      setWaterGoalDraft(null);
      hapticSuccess();
      showToast('Objetivo de agua guardado.');
    } else {
      showToast('No se ha podido guardar el objetivo.', 'error');
    }
  };

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
        <Card style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </Card>
      ) : null}

      {goals ? <GoalsSummary goals={goals} goalText={describeGoal(profile)} /> : null}

      <ProfileForm
        key={profileKey(profile)}
        initial={profile}
        onSubmit={(data, meta) => void handleSave(data, meta)}
        saving={saving}
      />

      <Card>
        <SectionHeader title="Preferencias" />

        <Text style={styles.label}>Tema</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: preference === option.value }}
              onPress={() => {
                hapticSelection();
                void handleThemeChange(option.value);
              }}
              style={({ pressed }) => [
                styles.themeButton,
                preference === option.value && styles.themeButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={
                  preference === option.value
                    ? colors.textOnPrimary
                    : colors.text
                }
                name={option.icon}
                size={18}
              />
              <Text
                style={[
                  styles.themeButtonText,
                  preference === option.value && styles.themeButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Objetivo de agua (ml/día)</Text>
        <View style={styles.waterRow}>
          <TextInput
            accessibilityLabel="Objetivo de agua en mililitros"
            keyboardType="number-pad"
            onChangeText={setWaterGoalDraft}
            placeholder={String(storedWaterGoal)}
            placeholderTextColor={colors.textMuted}
            style={styles.waterInput}
            value={waterGoalDraft ?? String(storedWaterGoal)}
          />
          <View style={styles.waterButton}>
            <Button
              size="small"
              title="Guardar"
              onPress={handleWaterGoalChange}
            />
          </View>
        </View>
      </Card>

      <BackupCard onRestored={() => void load()} />

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Tus objetivos se recalcularán con la ecuación de Mifflin-St Jeor
          usando tu peso, altura, edad, sexo y nivel de actividad.
        </Text>
      </View>
    </Screen>
  );
}

/** Remounts the form when the stored profile changes elsewhere. */
function profileKey(profile: Parameters<typeof ProfileForm>[0]['initial']): string {
  if (!profile) return 'empty';
  return [
    profile.weightKg,
    profile.heightCm,
    profile.birthDate,
    profile.variant,
    profile.activityLevel,
  ].join('|');
}

function describeGoal(profile: Parameters<typeof profileKey>[0]): string | null {
  if (!profile || profile.goalType === 'maintain') return 'Objetivo: mantener el peso';
  const rate = String(profile.weeklyRateKg).replace('.', ',');
  return profile.goalType === 'lose'
    ? `Objetivo: perder ${rate} kg por semana`
    : `Objetivo: ganar ${rate} kg por semana`;
}

function GoalsSummary({
  goals,
  goalText,
}: {
  goals: NutritionGoals;
  goalText: string | null;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Card variant="hero">
      <Text style={styles.goalsTitle}>Tus objetivos diarios</Text>
      {goalText ? <Text style={styles.goalsSubtitle}>{goalText}</Text> : null}
      <View style={styles.goalsRow}>
        <GoalItem
          color={colors.accent}
          label="Calorías"
          unit="kcal"
          value={goals.caloriesKcal}
        />
        <GoalItem
          color={colors.onHero}
          label="Proteínas"
          unit="g"
          value={goals.proteinGrams}
        />
        <GoalItem color={colors.onHero} label="Carbos" unit="g" value={goals.carbohydrateGrams} />
        <GoalItem color={colors.onHero} label="Grasas" unit="g" value={goals.fatGrams} />
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorBanner: {
      backgroundColor: colors.dangerLight,
    },
    errorBannerText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
    goalsSubtitle: {
      color: colors.onHero,
      fontSize: 13,
      opacity: 0.85,
    },
    goalsTitle: {
      color: colors.onHero,
      fontFamily: fonts.heading,
      fontSize: typography.title.fontSize,
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
      color: colors.onHero,
      fontSize: 12,
      opacity: 0.75,
    },
    goalValue: {
      color: colors.onHero,
      fontSize: 16,
      fontWeight: '700',
    },
    goalUnit: {
      color: colors.onHero,
      fontSize: 12,
      fontWeight: '400',
      opacity: 0.7,
    },
    label: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    themeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    themeButton: {
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
    themeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeButtonText: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    themeButtonTextActive: {
      color: colors.textOnPrimary,
    },
    waterRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    waterInput: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontSize: 16,
      padding: spacing.md,
    },
    waterButton: {
      width: 120,
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
    pressed: {
      opacity: 0.8,
    },
  });
}
