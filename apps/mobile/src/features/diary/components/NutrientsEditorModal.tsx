import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  foodInputNutrientsSchema,
  type Nutrients,
} from '@jfood/core';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { describeNutrientsError } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface NutrientsEditorModalProps {
  visible: boolean;
  foodName: string;
  initial: Nutrients;
  /** Show the "also save in the food" switch (only for entries linked to a food). */
  canUpdateFood: boolean;
  onClose: () => void;
  /** Resolves with an error message, or null when saved. */
  onSave: (values: Nutrients, alsoUpdateFood: boolean) => Promise<string | null>;
}

const FIELDS = [
  { key: 'caloriesKcal', label: 'Calorías (kcal)' },
  { key: 'proteinGrams', label: 'Proteínas (g)' },
  { key: 'carbohydrateGrams', label: 'Carbohidratos (g)' },
  { key: 'fatGrams', label: 'Grasas (g)' },
  { key: 'fiberGrams', label: 'Fibra (g)' },
  { key: 'sugarsGrams', label: 'Azúcares (g)' },
  { key: 'saltGrams', label: 'Sal (g)' },
] as const;

/** Edits the nutrients per 100 g stored in ONE diary/plan entry. */
export function NutrientsEditorModal({
  visible,
  foodName,
  initial,
  canUpdateFood,
  onClose,
  onSave,
}: NutrientsEditorModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [texts, setTexts] = useState<Record<string, string>>(() => ({
    caloriesKcal: formatInitial(initial.caloriesKcal),
    proteinGrams: formatInitial(initial.proteinGrams),
    carbohydrateGrams: formatInitial(initial.carbohydrateGrams),
    fatGrams: formatInitial(initial.fatGrams),
    fiberGrams: formatInitial(initial.fiberGrams),
    sugarsGrams: formatInitial(initial.sugarsGrams),
    saltGrams: formatInitial(initial.saltGrams),
  }));
  const [alsoUpdateFood, setAlsoUpdateFood] = useState(canUpdateFood);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const parsed: Record<string, number | null> = {};

    for (const { key } of FIELDS) {
      const raw = (texts[key] ?? '').replace(',', '.').trim();
      if (raw === '') {
        parsed[key] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        setError('Los valores deben ser números o quedar vacíos.');
        return;
      }
      parsed[key] = value;
    }

    const result = foodInputNutrientsSchema.safeParse(parsed);
    if (!result.success) {
      setError(describeNutrientsError(result.error.issues));
      return;
    }

    setError(null);
    setSaving(true);
    const message = await onSave(result.data, alsoUpdateFood && canUpdateFood);
    setSaving(false);
    if (message) {
      setError(message);
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.backdrop}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.dialog}>
            <Text style={styles.title}>Valores por 100 g</Text>
            <Text style={styles.subtitle}>{foodName}</Text>
            <Text style={styles.hint}>
              Deja vacío lo que no conozcas: nunca se contará como cero.
            </Text>

            {FIELDS.map(({ key, label }) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  keyboardType="decimal-pad"
                  onChangeText={(text) =>
                    setTexts((current) => ({ ...current, [key]: text }))
                  }
                  placeholder="Desconocido"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={texts[key] ?? ''}
                />
              </View>
            ))}

            {canUpdateFood ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Guardar también en el alimento
                </Text>
                <Switch
                  accessibilityLabel="Guardar también en el alimento"
                  onValueChange={setAlsoUpdateFood}
                  value={alsoUpdateFood}
                />
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.buttons}>
              <View style={styles.buttonFlex}>
                <Button title="Cancelar" variant="secondary" onPress={onClose} />
              </View>
              <View style={styles.buttonFlex}>
                <Button
                  disabled={saving}
                  loading={saving}
                  title="Guardar"
                  onPress={() => void handleSave()}
                />
              </View>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatInitial(value: number | null): string {
  return value === null ? '' : String(value);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    backdrop: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    dialog: { gap: spacing.md, width: '100%' },
    title: { color: colors.text, fontSize: 18, fontWeight: '700' },
    subtitle: { ...typography.body, color: colors.textMuted },
    hint: { ...typography.caption, color: colors.textMuted },
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
      minHeight: 48,
      padding: spacing.md,
    },
    switchRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    switchLabel: { ...typography.body, color: colors.text, flex: 1 },
    errorText: { ...typography.caption, color: colors.danger },
    buttons: { flexDirection: 'row', gap: spacing.md },
    buttonFlex: { flex: 1 },
  });
}
