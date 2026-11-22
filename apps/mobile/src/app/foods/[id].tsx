import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { foodInputNutrientsSchema } from '@jfood/core';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { describeNutrientsError } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ServingsCard } from '@/features/foods/components/ServingsCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import {
  deleteFood,
  duplicateFoodAsUser,
  getFoodById,
  getFoodUsageCount,
  updateFood,
} from '@/data/sqlite/repositories/foodRepository';
import {
  hapticSuccess,
  hapticWarning,
} from '@/features/haptics/haptics';
import { formatGrams } from '@/features/diary/utils/totals';
import { animateNextLayout } from '@/features/motion/motion';
import { isEditableSource, type Food } from '@/features/foods/types';
import { parseOptionalNumber } from '@/features/foods/utils/parseNumber';
import { useToast } from '@/components/Toast';
import {
  radius,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
  fonts,
  fontSizes,
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
  const [fiber, setFiber] = useState('');
  const [sugars, setSugars] = useState('');
  const [salt, setSalt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  /** Set at once, before React re-renders: two quick taps must make one copy. */
  const duplicatingRef = useRef(false);

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

  const isUserFood = food ? isEditableSource(food.source) : false;

  const handleDuplicate = async () => {
    if (!food || duplicatingRef.current) return;
    duplicatingRef.current = true;
    setDuplicating(true);
    try {
      const copy = await duplicateFoodAsUser(database, food.id);
      if (copy) {
        hapticSuccess();
        showToast('Ya tienes tu propia versión. Puedes editarla.');
        router.replace({ pathname: '/foods/[id]', params: { id: copy.id } });
      } else {
        showToast('El alimento ya no existe.', 'error');
      }
    } catch {
      showToast('No se ha podido duplicar el alimento.', 'error');
    } finally {
      duplicatingRef.current = false;
      setDuplicating(false);
    }
  };

  const startEditing = () => {
    if (!food) return;
    animateNextLayout();
    setName(food.name);
    setBrand(food.brand ?? '');
    setCalories(formatOptional(food.caloriesKcal));
    setProtein(formatOptional(food.proteinGrams));
    setCarbs(formatOptional(food.carbohydrateGrams));
    setFat(formatOptional(food.fatGrams));
    setFiber(formatOptional(food.fiberGrams));
    setSugars(formatOptional(food.sugarsGrams));
    setSalt(formatOptional(food.saltGrams));
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
    const fiberValue = parseOptionalNumber(fiber);
    const sugarsValue = parseOptionalNumber(sugars);
    const saltValue = parseOptionalNumber(salt);

    if (
      !caloriesValue.valid ||
      !proteinValue.valid ||
      !carbsValue.valid ||
      !fatValue.valid ||
      !fiberValue.valid ||
      !sugarsValue.valid ||
      !saltValue.valid
    ) {
      setFormError('Los valores deben ser números válidos o estar vacíos.');
      return;
    }

    const macros = foodInputNutrientsSchema.safeParse({
      caloriesKcal: caloriesValue.value,
      proteinGrams: proteinValue.value,
      carbohydrateGrams: carbsValue.value,
      fatGrams: fatValue.value,
      fiberGrams: fiberValue.value,
      sugarsGrams: sugarsValue.value,
      saltGrams: saltValue.value,
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
                color={colors.accent}
                label="Calorías"
                unit="kcal"
                value={food.caloriesKcal}
              />
              <MacroItem
                color={colors.protein}
                label="Proteínas"
                unit="g"
                value={food.proteinGrams}
              />
              <MacroItem
                color={colors.carbohydrates}
                label="Hidratos"
                unit="g"
                value={food.carbohydrateGrams}
              />
              <MacroItem color={colors.fat} label="Grasas" unit="g" value={food.fatGrams} />
            </View>
            <View style={styles.macroRow}>
              <MacroItem label="Fibra" unit="g" value={food.fiberGrams} />
              <MacroItem label="Azúcares" unit="g" value={food.sugarsGrams} />
              <MacroItem label="Sal" unit="g" value={food.saltGrams} />
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
              value={
                food.source === 'open_food_facts'
                  ? 'Open Food Facts (código de barras)'
                  : isUserFood
                    ? 'Creado por ti'
                    : 'Catálogo predefinido'
              }
            />
          </Card>

          <ServingsCard foodId={food.id} />

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
            <>
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  Este alimento pertenece al catálogo predefinido y no se puede
                  editar ni eliminar. Duplícalo para tener tu propia versión,
                  con sus raciones, y cambiar lo que quieras.
                </Text>
              </View>
              <Button
                icon="copy-outline"
                loading={duplicating}
                title="Duplicar como mío"
                onPress={() => void handleDuplicate()}
              />
            </>
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
                label="Hidratos (g)"
                value={carbs}
                onChange={setCarbs}
              />
              <Field keyboard label="Grasas (g)" value={fat} onChange={setFat} />
            </View>
            <View style={styles.macroFieldsRow}>
              <Field keyboard label="Fibra (g)" value={fiber} onChange={setFiber} />
              <Field
                keyboard
                label="Azúcares (g)"
                value={sugars}
                onChange={setSugars}
              />
              <Field keyboard label="Sal (g)" value={salt} onChange={setSalt} />
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
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  /** Colour of the nutrient (calories, protein, carbs, fat); the rest have none. */
  color?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value === null ? 'desconocido' : `${formatGrams(value)} ${unit}`}`}
      style={styles.macroItem}
    >
      <View style={styles.macroHeader}>
        {color ? <View style={[styles.macroDot, { backgroundColor: color }]} /> : null}
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
      <Text style={styles.macroValue}>
        {value === null ? '—' : formatGrams(value)}
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
  return (
    <TextField
      keyboardType={keyboard ? 'decimal-pad' : 'default'}
      label={label}
      onChangeText={onChange}
      style={fieldStyle}
      value={value}
    />
  );
}

// Two columns: three per row made labels such as "Azúcares (g)" wrap.
const fieldStyle = { flexBasis: '47%', flexGrow: 1 } as const;

function formatOptional(value: number | null): string {
  return value === null ? '' : String(value);
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
    macroHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    macroDot: {
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    macroLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    macroValue: {
      ...typography.body,
      color: colors.text,
      fontFamily: fonts.heading,
    },
    macroUnit: {
      ...typography.caption,
      color: colors.textMuted,
      fontFamily: fonts.regular,
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
      fontFamily: fonts.heading,
    },
    notice: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    noticeText: {
      color: colors.primary,
      fontSize: fontSizes.caption,
      fontFamily: fonts.regular,
      lineHeight: 19,
    },
    field: {
      flex: 1,
      gap: spacing.xs,
    },
    fieldLabel: {
      ...typography.body,
      color: colors.text,
      fontFamily: fonts.heading,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: fontSizes.bodyLarge,
      fontFamily: fonts.regular,
      padding: spacing.md,
    },
    macroFieldsRow: {
      flexWrap: 'wrap',
      flexDirection: 'row',
      gap: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSizes.caption,
      fontFamily: fonts.regular,
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
