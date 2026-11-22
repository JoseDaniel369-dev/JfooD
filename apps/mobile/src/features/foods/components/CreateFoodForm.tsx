import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { foodInputNutrientsSchema, makeNutrients } from '@jfood/core';

import { Button } from '@/components/Button';
import { describeNutrientsError } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { createFood, findFoodByBarcode } from '@/data/sqlite/repositories/foodRepository';
import type { Food } from '@/features/foods/types';
import { parseOptionalNumber } from '@/features/foods/utils/parseNumber';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface CreateFoodFormProps {
  initialName?: string;
  /** A scanned barcode to store with the new food (already normalized). */
  barcode?: string | null;
  onCreated: (food: Food) => void;
  onCancel: () => void;
}

/** Form to create a food by hand: values per 100 g, all optional except the name. */
export function CreateFoodForm({ initialName = '', barcode = null, onCreated, onCancel }: CreateFoodFormProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();

  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugars, setSugars] = useState('');
  const [salt, setSalt] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set synchronously: two quick taps can both still see "not saving". */
  const savingRef = useRef(false);

  const handleCreate = async () => {
    if (savingRef.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('El nombre es obligatorio.');
      return;
    }

    const fields = [calories, protein, carbs, fat, fiber, sugars, salt].map(parseOptionalNumber);
    if (fields.some((field) => !field.valid)) {
      setError('Revisa los valores nutricionales: deben ser números válidos o estar vacíos.');
      return;
    }
    const [kcal, p, c, f, fib, sug, sal] = fields.map((field) => field.value);

    const parsed = foodInputNutrientsSchema.safeParse(
      makeNutrients({
        caloriesKcal: kcal,
        proteinGrams: p,
        carbohydrateGrams: c,
        fatGrams: f,
        fiberGrams: fib,
        sugarsGrams: sug,
        saltGrams: sal,
      }),
    );
    if (!parsed.success) {
      setError(describeNutrientsError(parsed.error.issues));
      return;
    }

    setError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      if (barcode && (await findFoodByBarcode(database, barcode))) {
        setError('Ya existe un alimento con ese código de barras.');
        return;
      }
      const food = await createFood(database, {
        name: trimmed,
        brand: brand.trim() || null,
        barcode,
        ...parsed.data,
      });
      onCreated(food);
    } catch {
      setError('No se ha podido crear el alimento.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.hint}>Introduce los datos del alimento por cada 100 g.</Text>

      <Field label="Nombre *" onChange={setName} value={name} />
      <Field label="Marca (opcional)" onChange={setBrand} value={brand} />
      <Field keyboardType="decimal-pad" label="Calorías (kcal / 100 g)" onChange={setCalories} value={calories} />
      <View style={styles.row}>
        <Field keyboardType="decimal-pad" label="Proteínas (g)" onChange={setProtein} value={protein} />
        <Field keyboardType="decimal-pad" label="Hidratos (g)" onChange={setCarbs} value={carbs} />
        <Field keyboardType="decimal-pad" label="Grasas (g)" onChange={setFat} value={fat} />
      </View>

      <Pressable
        accessibilityLabel="Más datos: fibra, azúcares y sal"
        accessibilityRole="button"
        accessibilityState={{ expanded: showMore }}
        onPress={() => setShowMore((open) => !open)}
        style={styles.moreToggle}
      >
        <Text style={styles.moreText}>Más datos (fibra, azúcares, sal)</Text>
        <Ionicons color={colors.primary} name={showMore ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>
      {showMore ? (
        <View style={styles.row}>
          <Field keyboardType="decimal-pad" label="Fibra (g)" onChange={setFiber} value={fiber} />
          <Field keyboardType="decimal-pad" label="Azúcares (g)" onChange={setSugars} value={sugars} />
          <Field keyboardType="decimal-pad" label="Sal (g)" onChange={setSalt} value={salt} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttons}>
        <View style={styles.buttonFlex}>
          <Button title="Cancelar" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.buttonFlex}>
          <Button disabled={saving} loading={saving} title="Continuar" onPress={() => void handleCreate()} />
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onChangeText={onChange}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    form: {
      gap: spacing.md,
    },
    hint: {
      ...typography.body,
      color: colors.textMuted,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    field: {
      flex: 1,
      gap: spacing.xs,
    },
    label: {
      ...typography.caption,
      color: colors.text,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      padding: spacing.md,
    },
    moreToggle: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 44,
    },
    moreText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    error: {
      ...typography.caption,
      color: colors.danger,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    buttonFlex: {
      flex: 1,
    },
  });
}
