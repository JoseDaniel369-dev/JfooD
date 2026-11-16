import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { NutritionGoals } from '@jfood/core';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { setSetting } from '@/data/sqlite/repositories/settingsRepository';
import { saveProfile } from '@/data/sqlite/repositories/profileRepository';
import { hapticSuccess } from '@/features/haptics/haptics';
import { FadeInView } from '@/features/motion/FadeInView';
import { useCountUp } from '@/features/motion/useCountUp';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { useToast } from '@/components/Toast';
import {
  fonts,
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

type OnboardingStep = 'welcome' | 'profile' | 'goals';

const ONBOARDING_DONE_KEY = 'onboarding_done';

const VALUE_PROPS = [
  {
    icon: 'book-outline' as const,
    title: 'Diario sin conexión',
    text: 'Registra tus comidas estés donde estés. Todo queda guardado en tu móvil.',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Planifica tu semana',
    text: 'Organiza comidas por días y cópialas al diario con un toque.',
  },
  {
    icon: 'scale-outline' as const,
    title: 'Sigue tu progreso',
    text: 'Peso, rachas y objetivos calculados con tus propios datos.',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const { showToast } = useToast();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);

  const handleSkip = async () => {
    const ok = await finishOnboarding(database);
    if (ok) {
      router.replace('/(tabs)');
    } else {
      showToast('No se ha podido guardar el progreso. Inténtalo de nuevo.', 'error');
    }
  };

  const handleProfileSubmit = async (data: Parameters<typeof saveProfile>[1]) => {
    setSaving(true);
    try {
      const calculated = await saveProfile(database, data);
      setGoals(calculated);
      setStep('goals');
      hapticSuccess();
    } catch {
      showToast('No se ha podido guardar tu perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    const ok = await finishOnboarding(database);
    if (ok) {
      router.replace('/(tabs)');
    } else {
      showToast('No se ha podido guardar el progreso. Inténtalo de nuevo.', 'error');
    }
  };

  return (
    <Screen>
      {step === 'welcome' ? (
        <>
          <View style={styles.welcomeHeader}>
            <View style={styles.brandIcon}>
              <Ionicons color={colors.textOnPrimary} name="leaf" size={34} />
            </View>
            <Text style={styles.brand}>JfooD</Text>
            <Text style={styles.welcomeSubtitle}>
              Tu nutrición diaria, simple y privada
            </Text>
          </View>

          <View style={styles.valueProps}>
            {VALUE_PROPS.map((prop, index) => (
              <FadeInView key={prop.title} delay={index * 100}>
                <Card style={styles.valueCard}>
                  <View style={styles.valueIcon}>
                    <Ionicons color={colors.primary} name={prop.icon} size={24} />
                  </View>
                  <View style={styles.valueCopy}>
                    <Text style={styles.valueTitle}>{prop.title}</Text>
                    <Text style={styles.valueText}>{prop.text}</Text>
                  </View>
                </Card>
              </FadeInView>
            ))}
          </View>

          <Button
            title="Empezar"
            onPress={() => setStep('profile')}
          />
          <Button
            title="Saltar por ahora"
            variant="ghost"
            onPress={() => void handleSkip()}
          />
        </>
      ) : null}

      {step === 'profile' ? (
        <>
          <View style={styles.stepHeader}>
            <Text style={styles.stepEyebrow}>PASO 1 DE 2</Text>
            <Text style={styles.stepTitle}>Cuéntanos sobre ti</Text>
            <Text style={styles.stepSubtitle}>
              Con tu peso, altura y edad calculamos tus objetivos diarios con
              la ecuación de Mifflin-St Jeor. Sin cuentas, sin nube.
            </Text>
          </View>

          <ProfileForm
            onSubmit={(data) => void handleProfileSubmit(data)}
            saving={saving}
            submitLabel="Calcular mis objetivos"
          />

          <Button
            title="Saltar por ahora"
            variant="ghost"
            onPress={() => void handleSkip()}
          />
        </>
      ) : null}

      {step === 'goals' && goals ? (
        <>
          <View style={styles.stepHeader}>
            <Text style={styles.stepEyebrow}>PASO 2 DE 2</Text>
            <Text style={styles.stepTitle}>Tus objetivos diarios</Text>
            <Text style={styles.stepSubtitle}>
              Estos valores se usan en el diario y en la pantalla de inicio.
              Podrás cambiarlos cuando quieras desde tu perfil.
            </Text>
          </View>

          <Card variant="hero">
            <Text style={styles.goalsLabel}>CALORÍAS</Text>
            <Text style={styles.goalsCalories}>
              <AnimatedNumber value={goals.caloriesKcal} />
              <Text style={styles.goalsUnit}> kcal</Text>
            </Text>
            <View style={styles.goalsRow}>
              <GoalChip
                color={colors.onHero}
                label="Proteínas"
                value={goals.proteinGrams}
              />
              <GoalChip
                color={colors.onHero}
                label="Carbos"
                value={goals.carbohydrateGrams}
              />
              <GoalChip color={colors.onHero} label="Grasas" value={goals.fatGrams} />
            </View>
          </Card>

          <Button title="Ir a la app" onPress={() => void handleFinish()} />
        </>
      ) : null}
    </Screen>
  );
}

async function finishOnboarding(database: SQLiteDatabase): Promise<boolean> {
  try {
    await setSetting(database, ONBOARDING_DONE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

function AnimatedNumber({ value }: { value: number }) {
  const display = useCountUp(value, 800, 0);
  return <>{display}</>;
}

function GoalChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.goalChip}>
      <Text style={styles.goalChipLabel}>{label}</Text>
      <Text style={[styles.goalChipValue, { color }]}>
        <AnimatedNumber value={value} /> g
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    welcomeHeader: {
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xl,
    },
    brandIcon: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      height: 72,
      justifyContent: 'center',
      width: 72,
    },
    brand: {
      color: colors.text,
      fontFamily: fonts.brand,
      fontSize: 40,
      letterSpacing: -1,
    },
    welcomeSubtitle: {
      ...typography.body,
      color: colors.textMuted,
      fontSize: 16,
      textAlign: 'center',
    },
    valueProps: {
      gap: spacing.md,
    },
    valueCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.lg,
    },
    valueIcon: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    valueCopy: {
      flex: 1,
      gap: 2,
    },
    valueTitle: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    valueText: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
    },
    stepHeader: {
      gap: spacing.sm,
    },
    stepEyebrow: {
      ...typography.label,
      color: colors.primary,
    },
    stepTitle: {
      color: colors.text,
      fontFamily: fonts.heading,
      fontSize: 28,
      letterSpacing: -0.5,
    },
    stepSubtitle: {
      ...typography.body,
      color: colors.textMuted,
      lineHeight: 21,
    },
    goalsLabel: {
      color: colors.onHero,
      fontSize: typography.label.fontSize,
      fontWeight: '700',
      letterSpacing: typography.label.letterSpacing,
      opacity: 0.75,
    },
    goalsCalories: {
      color: colors.onHero,
      fontSize: 44,
      fontWeight: '700',
      letterSpacing: -1.5,
    },
    goalsUnit: {
      color: colors.onHero,
      fontSize: 15,
      opacity: 0.7,
    },
    goalsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    goalChip: {
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: radius.md,
      flex: 1,
      gap: 2,
      padding: spacing.md,
    },
    goalChipLabel: {
      color: colors.onHero,
      fontSize: 12,
      opacity: 0.75,
    },
    goalChipValue: {
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
