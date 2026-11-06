import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ACTIVITY_LEVELS,
  MIFFLIN_VARIANTS,
  userProfileSchema,
  type ActivityLevel,
  type MifflinVariant,
  type UserProfile,
} from '@jfood/core';

import { Card } from '@/components/Card';
import { colors, radius, spacing } from '@/theme';

interface ProfileFormProps {
  initial?: UserProfile | null;
  saving: boolean;
  onSubmit: (data: UserProfile) => void;
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

export function ProfileForm({ initial, saving, onSubmit }: ProfileFormProps) {
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
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    onSubmit(parsed.data);
  };

  const errorFor = (key: keyof UserProfile) => fieldErrors[key];

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.label}>Peso actual (kg)</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setWeight}
          placeholder="Ej. 70"
          style={[styles.input, errorFor('weightKg') && styles.inputError]}
          value={weight}
        />
        {errorFor('weightKg') ? (
          <Text style={styles.errorText}>{errorFor('weightKg')}</Text>
        ) : null}

        <Text style={styles.label}>Altura (cm)</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setHeight}
          placeholder="Ej. 175"
          style={[styles.input, errorFor('heightCm') && styles.inputError]}
          value={height}
        />
        {errorFor('heightCm') ? (
          <Text style={styles.errorText}>{errorFor('heightCm')}</Text>
        ) : null}

        <Text style={styles.label}>Fecha de nacimiento</Text>
        <TextInput
          onChangeText={setBirthDate}
          placeholder="AAAA-MM-DD"
          style={[styles.input, errorFor('birthDate') && styles.inputError]}
          value={birthDate}
        />
        {errorFor('birthDate') ? (
          <Text style={styles.errorText}>{errorFor('birthDate')}</Text>
        ) : null}
      </Card>

      <Card>
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

      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={handleSubmit}
        style={({ pressed }) => [
          styles.button,
          pressed && !saving && styles.buttonPressed,
          saving && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {saving ? 'Guardando…' : 'Guardar perfil'}
        </Text>
      </Pressable>
    </View>
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
  return (
    <Pressable
      onPress={onPress}
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

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: colors.textOnPrimary,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
