import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ACTIVITY_LEVELS,
  MIFFLIN_VARIANTS,
  PROFILE_LIMITS,
  userProfileSchema,
  type ActivityLevel,
  type MifflinVariant,
  type UserProfile,
} from '@jfood/core';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { hapticSelection } from '@/features/haptics/haptics';
import { useShake } from '@/features/motion/useShake';
import { formatLocalDate } from '@/features/diary/utils/date';
import {
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

export interface ProfileSubmitMeta {
  /** Weight the form displayed when it was created (null for a blank form). */
  loadedWeightKg: number | null;
}

interface ProfileFormProps {
  initial?: UserProfile | null;
  saving: boolean;
  onSubmit: (data: UserProfile, meta: ProfileSubmitMeta) => void;
  submitLabel?: string;
}

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario',
  light: 'Ligero',
  moderate: 'Moderado',
  high: 'Alto',
  very_high: 'Muy alto',
};

const VARIANT_LABELS: Record<MifflinVariant, string> = {
  male: 'Hombre',
  female: 'Mujer',
};

export function ProfileForm({
  initial,
  saving,
  onSubmit,
  submitLabel = 'Guardar perfil',
}: ProfileFormProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [weight, setWeight] = useState(
    initial?.weightKg ? String(initial.weightKg) : '',
  );
  const [height, setHeight] = useState(
    initial?.heightCm ? String(initial.heightCm) : '',
  );
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [variant, setVariant] = useState<MifflinVariant | null>(
    initial?.variant ?? null,
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    initial?.activityLevel ?? null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { translateX, shake } = useShake();

  const handleSubmit = () => {
    const parsed = userProfileSchema.safeParse({
      weightKg: parseNumber(weight),
      heightCm: parseNumber(height),
      birthDate,
      variant,
      activityLevel,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') {
          errors[key] = getFieldErrorMessage(key, issue.message);
        }
      }
      setFieldErrors(errors);
      shake();
      return;
    }

    setFieldErrors({});
    onSubmit(parsed.data, { loadedWeightKg: initial?.weightKg ?? null });
  };

  const errorFor = (key: keyof UserProfile) => fieldErrors[key];

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setBirthDate(`${selectedDate.getFullYear()}-${month}-${day}`);
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX }] }]}>
      <Card>
        <SectionHeader title="Datos personales" />
        <Text style={styles.label}>Peso actual (kg)</Text>
        <TextInput
          accessibilityLabel="Peso actual en kilogramos"
          keyboardType="decimal-pad"
          onChangeText={setWeight}
          placeholder="Ej. 70"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, errorFor('weightKg') && styles.inputError]}
          value={weight}
        />
        {errorFor('weightKg') ? (
          <Text style={styles.errorText}>{errorFor('weightKg')}</Text>
        ) : null}

        <Text style={styles.label}>Altura (cm)</Text>
        <TextInput
          accessibilityLabel="Altura en centímetros"
          keyboardType="decimal-pad"
          onChangeText={setHeight}
          placeholder="Ej. 175"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, errorFor('heightCm') && styles.inputError]}
          value={height}
        />
        {errorFor('heightCm') ? (
          <Text style={styles.errorText}>{errorFor('heightCm')}</Text>
        ) : null}

        <Text style={styles.label}>Fecha de nacimiento</Text>
        <Pressable
          accessibilityLabel="Seleccionar fecha de nacimiento"
          accessibilityRole="button"
          onPress={() => setShowDatePicker(true)}
          style={({ pressed }) => [
            styles.dateButton,
            errorFor('birthDate') && styles.inputError,
            pressed && styles.pressed,
          ]}
        >
          <Text style={birthDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
            {birthDate ? formatLocalDate(birthDate) : 'Seleccionar fecha'}
          </Text>
          <Ionicons color={colors.primary} name="calendar-outline" size={18} />
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            display="default"
            maximumDate={new Date()}
            mode="date"
            value={parseLocalDate(birthDate) ?? new Date(2000, 0, 1)}
            onChange={handleDateChange}
          />
        ) : null}
        {errorFor('birthDate') ? (
          <Text style={styles.errorText}>{errorFor('birthDate')}</Text>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Sexo y actividad" />
        <Text style={styles.label}>Sexo</Text>
        <View style={styles.optionsRow}>
          {MIFFLIN_VARIANTS.map((value) => (
            <OptionButton
              key={value}
              label={VARIANT_LABELS[value]}
              selected={variant === value}
              onPress={() => setVariant(value)}
            />
          ))}
        </View>
        {errorFor('variant') ? (
          <Text style={styles.errorText}>{errorFor('variant')}</Text>
        ) : null}

        <Text style={styles.label}>Nivel de actividad</Text>
        <View style={styles.optionsColumn}>
          {ACTIVITY_LEVELS.map((value) => (
            <OptionButton
              key={value}
              fullWidth
              label={ACTIVITY_LABELS[value]}
              selected={activityLevel === value}
              onPress={() => setActivityLevel(value)}
            />
          ))}
        </View>
        {errorFor('activityLevel') ? (
          <Text style={styles.errorText}>{errorFor('activityLevel')}</Text>
        ) : null}
      </Card>

      <Button loading={saving} title={submitLabel} onPress={handleSubmit} />
    </Animated.View>
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}

function OptionButton({
  label,
  selected,
  onPress,
  fullWidth = false,
}: OptionButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.option,
        fullWidth && styles.optionFullWidth,
        selected && styles.optionSelected,
        pressed && styles.optionPressed,
      ]}
    >
      <Text
        style={[styles.optionText, selected && styles.optionTextSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function parseNumber(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && normalized.trim() !== '' ? parsed : NaN;
}

function parseLocalDate(localDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  if (
    date.getFullYear() === year &&
    date.getMonth() === (month ?? 1) - 1 &&
    date.getDate() === day
  ) {
    return date;
  }
  return null;
}

function getFieldErrorMessage(field: string, zodMessage: string): string {
  if (zodMessage.toLowerCase().includes('required')) {
    return 'Campo obligatorio.';
  }

  switch (field) {
    case 'weightKg':
      return `Introduce un peso entre ${PROFILE_LIMITS.minWeightKg} y ${PROFILE_LIMITS.maxWeightKg} kg.`;
    case 'heightCm':
      return `Introduce una altura entre ${PROFILE_LIMITS.minHeightCm} y ${PROFILE_LIMITS.maxHeightCm} cm.`;
    case 'birthDate':
      // Custom messages from the shared schema are already in Spanish.
      return /edad|futuro|válida/i.test(zodMessage)
        ? zodMessage
        : 'Selecciona una fecha de nacimiento válida.';
    case 'variant':
      return 'Selecciona una opción.';
    case 'activityLevel':
      return 'Selecciona tu nivel de actividad.';
    default:
      return 'Valor no válido.';
  }
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
    },
    label: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    inputError: {
      borderColor: colors.danger,
    },
    dateButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    dateButtonText: {
      color: colors.text,
      fontSize: 16,
      textTransform: 'capitalize',
    },
    dateButtonPlaceholder: {
      color: colors.textMuted,
      fontSize: 16,
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      marginBottom: spacing.sm,
      marginTop: -spacing.sm,
    },
    optionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    optionsColumn: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    option: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minHeight: 48,
      justifyContent: 'center',
      padding: spacing.md,
    },
    optionFullWidth: {
      flex: 0,
    },
    optionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionPressed: {
      opacity: 0.8,
    },
    optionText: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    optionTextSelected: {
      color: colors.textOnPrimary,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
