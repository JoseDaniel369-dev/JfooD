import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { foodInputNutrientsSchema } from '@jfood/core';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { describeNutrientsError } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  deleteFood,
  getFoodById,
  getFoodUsageCount,
  updateFood,
} from '@/data/sqlite/repositories/foodRepository';
import {
  hapticSuccess,
  hapticWarning,
} from '@/features/haptics/haptics';
import { animateNextLayout } from '@/features/motion/motion';
import type { Food } from '@/features/foods/types';
import { useToast } from '@/components/Toast';
import {
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

export default function FoodDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const { showToast } = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [food, setFood] = useState<Food | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('No se ha indicado el alimento.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loaded, count] = await Promise.all([
        getFoodById(database, id),
        getFoodUsageCount(database, id),
      ]);
      if (!loaded) {
        setError('El alimento ya no existe.');
        setLoading(false);
        return;
      }
      setFood(loaded);
      setUsageCount(count);
      setLoading(false);
    } catch {
      setError('No se ha podido cargar el alimento.');
      setLoading(false);
    }
  }, [database, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isUserFood = food?.source === 'user';

  const startEditing = () => {
    if (!food) return;
    animateNextLayout();
    setName(food.name);
    setBrand(food.brand ?? '');
    setCalories(formatOptional(food.caloriesKcal));
    setProtein(formatOptional(food.proteinGrams));
    setCarbs(formatOptional(food.carbohydrateGrams));
    setFat(formatOptional(food.fatGrams));
    setFormError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!food) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('El nombre es obligatorio.');
      return;
    }

    const caloriesValue = parseOptionalNumber(calories);
    const proteinValue = parseOptionalNumber(protein);
    const carbsValue = parseOptionalNumber(carbs);
    const fatValue = parseOptionalNumber(fat);

    if (
      !caloriesValue.valid ||
      !proteinValue.valid ||
      !carbsValue.valid ||
      !fatValue.valid
    ) {
      setFormError('Los valores deben ser números válidos o estar vacíos.');
      return;
    }

    const macros = foodInputNutrientsSchema.safeParse({
      caloriesKcal: caloriesValue.value,
      proteinGrams: proteinValue.value,
      carbohydrateGrams: carbsValue.value,
      fatGrams: fatValue.value,
    });

    if (!macros.success) {
      setFormError(describeNutrientsError(macros.error.issues));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateFood(database, food.id, {
        name: trimmedName,
        brand: brand.trim() || null,
        ...macros.data,
      });
      if (updated) {
        setFood(updated);
      }
      animateNextLayout();
      setEditing(false);
      hapticSuccess();
      showToast('Alimento actualizado.');
    } catch {
      setFormError('No se ha podido actualizar el alimento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!food) return;

    try {
      await deleteFood(database, food.id);
      hapticWarning();
      showToast('Alimento eliminado. Tu historial se conserva.');
      router.back();
    } catch {
      showToast('No se ha podido eliminar el alimento.', 'error');
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !food) {
    return (
      <Screen>
        <ErrorState
          message={error ?? 'No se ha encontrado el alimento.'}
          onRetry={() => void load()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={food.name} subtitle={food.brand ?? undefined} />

      {!editing ? (
        <>
          <Card>
            <Text style={styles.sectionTitle}>Valores por 100 g</Text>
            <View style={styles.macroRow}>
              <MacroItem
                label="Calorías"
                unit="kcal"
                value={food.caloriesKcal}
              />
              <MacroItem
                label="Proteínas"
                unit="g"
                value={food.proteinGrams}
              />
              <MacroItem
                label="Carbos"
                unit="g"
                value={food.carbohydrateGrams}
              />
              <MacroItem label="Grasas" unit="g" value={food.fatGrams} />
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Información</Text>
            <InfoRow
              label="Usos en tu diario y plan"
              value={String(usageCount)}
            />
            <InfoRow
              label="Origen"
              value={isUserFood ? 'Creado por ti' : 'Catálogo predefinido'}
            />
          </Card>

          {isUserFood ? (
            <>
              <Button
                icon="create-outline"
                title="Editar alimento"
                onPress={startEditing}
              />
              <Button
                icon="trash-outline"
                title="Eliminar alimento"
                variant="ghost"
                onPress={() => setShowDeleteConfirm(true)}
              />
            </>
          ) : (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Este alimento pertenece al catálogo predefinido y no se puede
                editar ni eliminar. Puedes crear tu propia versión desde
                «Añadir alimento».
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.sectionTitle}>Editar alimento</Text>
            <Field label="Nombre *" value={name} onChange={setName} />
            <Field label="Marca (opcional)" value={brand} onChange={setBrand} />
            <Field
              keyboard
              label="Calorías (kcal / 100 g)"
              value={calories}
              onChange={setCalories}
            />
            <View style={styles.macroFieldsRow}>
              <Field
                keyboard
                label="Proteínas (g)"
                value={protein}
                onChange={setProtein}
              />
              <Field
                keyboard
                label="Carbos (g)"
                value={carbs}
                onChange={setCarbs}
              />
              <Field keyboard label="Grasas (g)" value={fat} onChange={setFat} />
            </View>
            {formError ? (
              <Text style={styles.errorText}>{formError}</Text>
            ) : null}
          </Card>

          <View style={styles.buttonRow}>
            <View style={styles.buttonFlex}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => {
                  animateNextLayout();
                  setEditing(false);
                }}
              />
            </View>
            <View style={styles.buttonFlex}>
              <Button
                loading={saving}
                title="Guardar"
                onPress={handleSave}
              />
            </View>
          </View>
        </>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar"
        destructive
        message={`Se eliminará "${food.name}" del catálogo. Las entradas ya registradas conservan sus valores, pero ya no podrás volver a añadirlo.`}
        title="Eliminar alimento"
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDelete()}
      />
    </Screen>
  );
}

function MacroItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {value === null ? '—' : value}
        <Text style={styles.macroUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboard = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboard ? 'decimal-pad' : 'default'}
        onChangeText={onChange}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function formatOptional(value: number | null): string {
  return value === null ? '' : String(value);
}

interface OptionalNumber {
  value: number | null;
  valid: boolean;
}

function parseOptionalNumber(value: string): OptionalNumber {
  const normalized = value.replace(',', '.').trim();
  if (normalized === '') {
    return { value: null, valid: true };
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed)
    ? { value: parsed, valid: true }
    : { value: null, valid: false };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionTitle: {
      ...typography.title,
      color: colors.text,
    },
    macroRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    macroItem: {
      alignItems: 'center',
      flex: 1,
      gap: spacing.xs,
    },
    macroLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    macroValue: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    macroUnit: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: '400',
    },
    infoRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    infoLabel: {
      ...typography.body,
      color: colors.textMuted,
    },
    infoValue: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    notice: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    noticeText: {
      color: colors.primary,
      fontSize: 13,
      lineHeight: 19,
    },
    field: {
      flex: 1,
      gap: spacing.xs,
    },
    fieldLabel: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      padding: spacing.md,
    },
    macroFieldsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    buttonFlex: {
      flex: 1,
    },
  });
}
