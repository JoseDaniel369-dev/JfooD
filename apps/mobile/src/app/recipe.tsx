import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { computeRecipe } from '@jfood/core';

import { runInTransaction } from '@/data/sqlite/utils/transaction';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { createFood, searchFoods } from '@/data/sqlite/repositories/foodRepository';
import { saveServing } from '@/data/sqlite/repositories/servingRepository';
import { hapticSuccess } from '@/features/haptics/haptics';
import { parseSpanishNumber } from '@/features/foods/utils/parseNumber';
import { rowLayout } from '@/features/motion/springs';
import { foodNutrients, type Food } from '@/features/foods/types';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface Ingredient {
  food: Food;
  grams: string;
}

/** A typed amount ("1,5", "1.200"); NaN when it is not a number, so the recipe reports it. */
function toNumber(text: string): number {
  return parseSpanishNumber(text, { thousands: true }) ?? Number.NaN;
}

/** Builds a recipe from catalog foods and saves it as a regular food (per 100 g). */
export default function RecipeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [portions, setPortions] = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (!text) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void searchFoods(database, text, 8)
        .then((foods) => {
          if (!cancelled) setResults(foods);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [database, query]);

  const visibleResults = query.trim() ? results : [];

  const computed = useMemo(() => {
    if (ingredients.length === 0) return { error: null, result: null };
    try {
      const weight = finalWeight.trim() === '' ? undefined : toNumber(finalWeight);
      return {
        error: null,
        result: computeRecipe(
          ingredients.map((item) => ({
            per100g: foodNutrients(item.food),
            grams: toNumber(item.grams),
          })),
          weight,
        ),
      };
    } catch {
      return { error: 'Revisa los gramos de los ingredientes y el peso final.', result: null };
    }
  }, [ingredients, finalWeight]);

  const portionsValue = portions.trim() === '' ? 0 : toNumber(portions);
  const portionCount = Number.isFinite(portionsValue) ? Math.floor(portionsValue) : 0;
  const portionsAreFractional = Number.isFinite(portionsValue) && portionsValue !== portionCount;
  const perPortion =
    computed.result && portionCount > 0
      ? computed.result.totalGrams / portionCount
      : null;

  const addIngredient = (food: Food) => {
    setIngredients((current) =>
      current.some((item) => item.food.id === food.id)
        ? current
        : [...current, { food, grams: '100' }],
    );
    setQuery('');
  };

  /** Set at once: two taps in one frame must save one recipe. */
  const savingRef = useRef(false);

  const handleSave = async () => {
    const recipeName = name.trim();
    if (!recipeName) {
      showToast('Escribe un nombre para la receta.', 'error');
      return;
    }
    if (!computed.result) {
      showToast(computed.error ?? 'Añade al menos un ingrediente.', 'error');
      return;
    }
    if (portions.trim() !== '' && !(portionCount >= 1 && portionCount <= 100)) {
      showToast('Las raciones deben ser un número entre 1 y 100.', 'error');
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const per100g = computed.result.per100g;
      // One transaction: a failed portion must not leave a half-saved recipe
      // that a retry would then duplicate.
      await runInTransaction(database, async () => {
        const food = await createFood(database, {
          name: recipeName,
          brand: 'Receta',
          ...per100g,
        });
        if (perPortion) {
          await saveServing(database, food.id, '1 ración', Math.round(perPortion * 10) / 10);
        }
      });
      hapticSuccess();
      showToast('Receta guardada como alimento.');
      router.back();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se ha podido guardar la receta.',
        'error',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const kcal = computed.result?.per100g.caloriesKcal;

  return (
    <Screen>
      <ScreenHeader subtitle="Combina alimentos y guarda el resultado como un alimento más." />

      <Card>
        <TextField
          accessibilityLabel="Nombre de la receta"
          label="Nombre"
          onChangeText={setName}
          placeholder="Ej. Lentejas estofadas"
          value={name}
        />
        <View style={styles.row}>
          <TextField
            accessibilityLabel="Número de raciones"
            hint={
              portionsAreFractional
                ? `Se usarán ${portionCount} raciones.`
                : 'Opcional'
            }
            keyboardType="number-pad"
            label="Raciones"
            onChangeText={setPortions}
            placeholder="4"
            style={styles.flex}
            value={portions}
          />
          <TextField
            accessibilityLabel="Peso final cocinado en gramos"
            hint="Opcional: lo que pesa ya cocinado"
            keyboardType="decimal-pad"
            label="Peso final (g)"
            onChangeText={setFinalWeight}
            placeholder="Cocinado"
            style={styles.flex}
            value={finalWeight}
          />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Ingredientes" caption="Cantidad cruda, en gramos" />
        {ingredients.map((item) => (
          <Animated.View
            key={item.food.id}
            entering={FadeIn}
            exiting={FadeOut}
            layout={rowLayout}
            style={styles.ingredientRow}
          >
            <Text numberOfLines={2} style={styles.ingredientName}>
              {item.food.name}
            </Text>
            <TextField
              accessibilityLabel={`Gramos de ${item.food.name}`}
              inputStyle={styles.gramsInput}
              keyboardType="decimal-pad"
              onChangeText={(text) =>
                setIngredients((current) =>
                  current.map((other) =>
                    other.food.id === item.food.id ? { ...other, grams: text } : other,
                  ),
                )
              }
              style={styles.gramsField}
              value={item.grams}
            />
            <Text style={styles.unit}>g</Text>
            <Pressable
              accessibilityLabel={`Quitar ${item.food.name}`}
              accessibilityRole="button"
              onPress={() =>
                setIngredients((current) =>
                  current.filter((other) => other.food.id !== item.food.id),
                )
              }
              style={styles.remove}
            >
              <Ionicons color={colors.textMuted} name="close-circle-outline" size={22} />
            </Pressable>
          </Animated.View>
        ))}

        <TextField
          accessibilityLabel="Buscar ingrediente"
          onChangeText={setQuery}
          placeholder="Buscar alimento para añadir…"
          value={query}
        />
        {visibleResults.map((food) => (
          <Pressable
            key={food.id}
            accessibilityLabel={`Añadir ${food.name}`}
            accessibilityRole="button"
            onPress={() => addIngredient(food)}
            style={({ pressed }) => [styles.result, pressed && styles.pressed]}
          >
            <Ionicons color={colors.primary} name="add-circle-outline" size={22} />
            <Text style={styles.resultText}>{food.name}</Text>
          </Pressable>
        ))}
        {query.trim() && visibleResults.length === 0 ? (
          <Text style={styles.hint}>Ningún alimento coincide. Créalo antes desde «Crear alimento».</Text>
        ) : null}
      </Card>

      {computed.error ? <Text style={styles.error}>{computed.error}</Text> : null}
      {computed.result ? (
        <Card>
          <SectionHeader title="Resultado por 100 g" />
          <View style={styles.macroRow}>
            <ResultStat color={colors.accent} label="Calorías" value={kcal === null || kcal === undefined ? '—' : String(Math.round(kcal))} unit="kcal" />
            <ResultStat color={colors.protein} label="Proteínas" value={fmt(computed.result.per100g.proteinGrams)} unit="g" />
            <ResultStat color={colors.carbohydrates} label="Hidratos" value={fmt(computed.result.per100g.carbohydrateGrams)} unit="g" />
            <ResultStat color={colors.fat} label="Grasas" value={fmt(computed.result.per100g.fatGrams)} unit="g" />
          </View>
          <Text style={styles.hint}>
            Peso total {Math.round(computed.result.totalGrams)} g
            {perPortion ? ` · 1 ración = ${Math.round(perPortion)} g` : ''}
            {kcal === null ? '. Algún ingrediente no tiene calorías: quedan como desconocidas.' : ''}
          </Text>
        </Card>
      ) : null}

      <Button
        disabled={saving || ingredients.length === 0}
        loading={saving}
        title="Guardar receta"
        onPress={() => void handleSave()}
      />
    </Screen>
  );
}

function fmt(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(Math.round(value * 10) / 10).replace('.', ',');
}

function ResultStat({
  color,
  label,
  value,
  unit,
}: {
  color: string;
  label: string;
  value: string;
  unit: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View accessible accessibilityLabel={`${label}: ${value} ${unit}`} style={styles.stat}>
      <View style={styles.statHeader}>
        <View style={[styles.statDot, { backgroundColor: color }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: 'row', gap: spacing.md },
    ingredientRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    ingredientName: { ...typography.body, color: colors.text, flex: 1 },
    gramsField: { width: 92 },
    gramsInput: { textAlign: 'right' },
    unit: { ...typography.body, color: colors.textMuted },
    remove: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
    result: { alignItems: 'center', borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.xs },
    pressed: { backgroundColor: colors.primaryLight },
    resultText: { ...typography.body, color: colors.text },
    macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    stat: { flexBasis: '45%', flexGrow: 1, gap: 2 },
    statHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
    statDot: { borderRadius: radius.pill, height: 8, width: 8 },
    statLabel: { ...typography.micro, color: colors.textMuted },
    statValue: { ...typography.title, color: colors.text },
    statUnit: { ...typography.caption, color: colors.textMuted },
    hint: { ...typography.caption, color: colors.textMuted },
    error: { ...typography.caption, color: colors.danger },
  });
}
