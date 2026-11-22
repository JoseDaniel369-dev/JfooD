import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import type { NutritionGoals } from '@jfood/core';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Confetti } from '@/components/Confetti';
import { Screen } from '@/components/Screen';
import { StepIndicator } from '@/components/StepIndicator';
import { TextField } from '@/components/TextField';
import { setSetting } from '@/data/sqlite/repositories/settingsRepository';
import { saveProfile } from '@/data/sqlite/repositories/profileRepository';
import { hapticSuccess } from '@/features/haptics/haptics';
import { staggerIn } from '@/features/motion/springs';
import { GoalsSummary } from '@/features/profile/components/GoalsSummary';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { useDisplayName } from '@/features/profile/hooks/useDisplayName';
import { ONBOARDING_DONE_KEY } from '@/features/profile/onboarding';
import {
  requestReminderPermission,
  saveReminderSettings,
  scheduleReminders,
} from '@/features/reminders/notifications';
import { DEFAULT_REMINDER_SETTINGS } from '@/features/reminders/settings';
import { useToast } from '@/components/Toast';
import {
  fonts,
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
  fontSizes,
} from '@/theme';

type OnboardingStep = 'welcome' | 'profile' | 'reminders' | 'done';

const STEPS: OnboardingStep[] = ['welcome', 'profile', 'reminders', 'done'];

type MealKey = 'breakfast' | 'lunch' | 'dinner';

const MEAL_CHOICES: { key: MealKey; emoji: string; label: string }[] = [
  { key: 'breakfast', emoji: '🍳', label: 'Desayuno · 9:00' },
  { key: 'lunch', emoji: '🥗', label: 'Almuerzo · 14:00' },
  { key: 'dinner', emoji: '🍝', label: 'Cena · 21:00' },
];

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

  const { save: saveName } = useDisplayName();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [meals, setMeals] = useState<MealKey[]>([]);
  const [burst, setBurst] = useState(0);

  /** The step before this one, or null on the first (and on the last, which cannot be undone). */
  const previousStep: OnboardingStep | null =
    step === 'profile' ? 'welcome' : step === 'reminders' ? 'profile' : null;

  // Android back goes to the previous step instead of leaving the app halfway.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving || step === 'done') return true;
      if (previousStep === null) return false;
      setStep(previousStep);
      return true;
    });
    return () => subscription.remove();
  }, [previousStep, saving, step]);

  /** Set at once: a double tap on "Empezar" saves the name once and moves on once. */
  const startingRef = useRef(false);

  const handleStart = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // The name is optional: a failure to save it must not block the onboarding.
      if (nameDraft.trim() !== '') {
        await saveName(nameDraft);
      }
      setStep('profile');
    } finally {
      startingRef.current = false;
    }
  };

  const toggleMeal = (key: MealKey) =>
    setMeals((current) => (current.includes(key) ? current.filter((m) => m !== key) : [...current, key]));

  /** Set at once: a second tap while the permission dialog is open must do nothing. */
  const remindersBusyRef = useRef(false);

  const handleReminders = async (chosen: MealKey[]) => {
    if (remindersBusyRef.current) return;
    remindersBusyRef.current = true;
    if (chosen.length > 0) {
      setSaving(true);
      try {
        if (await requestReminderPermission()) {
          await saveReminderSettings(database, {
            ...DEFAULT_REMINDER_SETTINGS,
            breakfast: { ...DEFAULT_REMINDER_SETTINGS.breakfast, enabled: chosen.includes('breakfast') },
            lunch: { ...DEFAULT_REMINDER_SETTINGS.lunch, enabled: chosen.includes('lunch') },
            dinner: { ...DEFAULT_REMINDER_SETTINGS.dinner, enabled: chosen.includes('dinner') },
          });
          void scheduleReminders(database);
        } else {
          showToast('Sin permiso de notificaciones no podemos avisarte. Puedes activarlo en Perfil.', 'error');
        }
      } catch {
        showToast('No se han podido guardar los recordatorios. Puedes activarlos en Perfil.', 'error');
      } finally {
        setSaving(false);
      }
    }
    remindersBusyRef.current = false;
    setStep('done');
    setBurst(1);
    hapticSuccess();
  };

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
      setStep('reminders');
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
      <StepIndicator current={STEPS.indexOf(step)} steps={STEPS.length} />

      {step === 'welcome' ? (
        <Animated.View entering={FadeInRight.springify().damping(20)} key="welcome" style={styles.step}>
          <View style={styles.welcomeHeader}>
            <View style={styles.brandIcon}>
              <Ionicons color={colors.textOnPrimary} name="leaf" size={34} />
            </View>
            <Text style={styles.brand}>JfooD</Text>
            <Text style={styles.welcomeSubtitle}>
              Tu nutrición diaria, simple y en tu móvil
            </Text>
          </View>

          <View style={styles.valueProps}>
            {VALUE_PROPS.map((prop, index) => (
              <Animated.View key={prop.title} entering={staggerIn(index + 1)}>
                <Card style={styles.valueCard}>
                  <View style={styles.valueIcon}>
                    <Ionicons color={colors.primary} name={prop.icon} size={24} />
                  </View>
                  <View style={styles.valueCopy}>
                    <Text style={styles.valueTitle}>{prop.title}</Text>
                    <Text style={styles.valueText}>{prop.text}</Text>
                  </View>
                </Card>
              </Animated.View>
            ))}
          </View>

          <TextField
            accessibilityLabel="Tu nombre"
            autoCapitalize="words"
            label="¿Cómo te llamamos? (opcional)"
            maxLength={20}
            onChangeText={setNameDraft}
            placeholder="Tu nombre"
            returnKeyType="done"
            value={nameDraft}
          />

          <Button title="Empezar" onPress={() => void handleStart()} />
          <Button title="Saltar por ahora" variant="ghost" onPress={() => void handleSkip()} />
        </Animated.View>
      ) : null}

      {step === 'profile' ? (
        <Animated.View entering={FadeInRight.springify().damping(20)} key="profile" style={styles.step}>
          <View style={styles.stepHeader}>
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

          <View style={styles.footerRow}>
            <Button icon="arrow-back" title="Atrás" variant="ghost" onPress={() => setStep('welcome')} />
            <Button title="Saltar por ahora" variant="ghost" onPress={() => void handleSkip()} />
          </View>
        </Animated.View>
      ) : null}

      {step === 'reminders' ? (
        <Animated.View entering={FadeInRight.springify().damping(20)} key="reminders" style={styles.step}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>¿Quieres un empujoncito?</Text>
            <Text style={styles.stepSubtitle}>
              Elige a qué comidas quieres un aviso. Si ya la has registrado, no te molestamos.
              Se pueden cambiar cuando quieras desde Perfil.
            </Text>
          </View>

          <View style={styles.choices}>
            {MEAL_CHOICES.map((choice) => (
              <Chip
                key={choice.key}
                emoji={choice.emoji}
                label={choice.label}
                onPress={() => toggleMeal(choice.key)}
                selected={meals.includes(choice.key)}
              />
            ))}
          </View>

          <Button
            loading={saving}
            title={meals.length > 0 ? 'Activar avisos' : 'Continuar'}
            onPress={() => void handleReminders(meals)}
          />
          <View style={styles.footerRow}>
            <Button icon="arrow-back" title="Atrás" variant="ghost" onPress={() => setStep('profile')} />
            {meals.length > 0 ? (
              <Button title="Ahora no" variant="ghost" onPress={() => void handleReminders([])} />
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {step === 'done' ? (
        <Animated.View entering={FadeInRight.springify().damping(20)} key="done" style={styles.step}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>¡Todo listo!</Text>
            <Text style={styles.stepSubtitle}>
              {goals
                ? 'Estos son tus objetivos diarios. Podrás cambiarlos cuando quieras desde tu perfil.'
                : 'Ya puedes empezar a registrar tus comidas. Tus objetivos los calculas desde Perfil.'}
            </Text>
          </View>

          {goals ? <GoalsSummary goals={goals} /> : null}

          <Button title="Empezar" onPress={() => void handleFinish()} />
        </Animated.View>
      ) : null}

      <Confetti burst={burst} />
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
      fontSize: fontSizes.numeral,
      letterSpacing: -1,
    },
    welcomeSubtitle: {
      ...typography.body,
      color: colors.textMuted,
      fontSize: fontSizes.bodyLarge,
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
      fontFamily: fonts.heading,
    },
    valueText: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
    },
    step: {
      gap: spacing.lg,
    },
    footerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    choices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    stepHeader: {
      gap: spacing.sm,
    },
    stepTitle: {
      color: colors.text,
      fontFamily: fonts.heading,
      fontSize: fontSizes.titleLarge,
      letterSpacing: -0.5,
    },
    stepSubtitle: {
      ...typography.body,
      color: colors.textMuted,
      lineHeight: 21,
    },
  });
}
