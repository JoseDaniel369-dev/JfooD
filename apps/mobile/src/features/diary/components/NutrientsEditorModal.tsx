import { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { foodInputNutrientsSchema, type Nutrients } from '@jfood/core';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { describeNutrientsError } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { parseOptionalNumber } from '@/features/foods/utils/parseNumber';
import { spacing, typography, useTheme, type ThemeColors } from '@/theme';

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
  { key: 'carbohydrateGrams', label: 'Hidratos de carbono (g)' },
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
    if (saving) return;
    const parsed: Record<string, number | null> = {};

    for (const { key } of FIELDS) {
      const { value, valid } = parseOptionalNumber(texts[key] ?? '');
      if (!valid) {
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
    <BottomSheet onClose={onClose} title="Valores por 100 g" visible={visible}>
      <Text style={styles.subtitle}>{foodName}</Text>
      <Text style={styles.hint}>Deja vacío lo que no conozcas: nunca se contará como cero.</Text>

      {FIELDS.map(({ key, label }) => (
        <TextField
          key={key}
          keyboardType="decimal-pad"
          label={label}
          onChangeText={(text) => setTexts((current) => ({ ...current, [key]: text }))}
          placeholder="Desconocido"
          value={texts[key] ?? ''}
        />
      ))}

      {canUpdateFood ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Guardar también en el alimento</Text>
          <Switch
            accessibilityLabel="Guardar también en el alimento"
            onValueChange={setAlsoUpdateFood}
            thumbColor={alsoUpdateFood ? colors.primary : colors.surfaceRaised}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
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
    </BottomSheet>
  );
}

function formatInitial(value: number | null): string {
  return value === null ? '' : String(value);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
    hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
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
