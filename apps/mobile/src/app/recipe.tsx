import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { computeRecipe } from '@jfood/core';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import { createFood, searchFoods } from '@/data/sqlite/repositories/foodRepository';
import { saveServing } from '@/data/sqlite/repositories/servingRepository';
import { hapticSuccess } from '@/features/haptics/haptics';
import { foodNutrients, type Food } from '@/features/foods/types';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface Ingredient {
  food: Food;
  grams: string;
}

function toNumber(text: string): number {
  return Number(text.replace(',', '.'));
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

  const portionCount = portions.trim() === '' ? 0 : Math.floor(toNumber(portions));
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
      await database.withTransactionAsync(async () => {
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
      <ScreenHeader
        subtitle="Combina alimentos y guarda el resultado como un alimento más."
        title="Nueva receta"
      />

      <Card>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          accessibilityLabel="Nombre de la receta"
          onChangeText={setName}
          placeholder="Ej. Lentejas estofadas"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={name}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.label}>Raciones (opcional)</Text>
            <TextInput
              accessibilityLabel="Número de raciones"
              keyboardType="number-pad"
              onChangeText={setPortions}
              placeholder="4"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={portions}
            />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>Peso final (g, opcional)</Text>
            <TextInput
              accessibilityLabel="Peso final cocinado en gramos"
              keyboardType="decimal-pad"
              onChangeText={setFinalWeight}
              placeholder="Cocinado"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={finalWeight}
            />
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Ingredientes" caption="Cantidad cruda, en gramos" />
        {ingredients.map((item) => (
          <View key={item.food.id} style={styles.ingredientRow}>
            <Text numberOfLines={1} style={styles.ingredientName}>
              {item.food.name}
            </Text>
            <TextInput
              accessibilityLabel={`Gramos de ${item.food.name}`}
              keyboardType="decimal-pad"
              onChangeText={(text) =>
                setIngredients((current) =>
                  current.map((other) =>
                    other.food.id === item.food.id ? { ...other, grams: text } : other,
                  ),
                )
              }
              style={[styles.input, styles.gramsInput]}
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
          </View>
        ))}

        <TextInput
          accessibilityLabel="Buscar ingrediente"
          onChangeText={setQuery}
          placeholder="Buscar alimento para añadir…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={query}
        />
        {visibleResults.map((food) => (
          <Pressable
            key={food.id}
            accessibilityRole="button"
            onPress={() => addIngredient(food)}
            style={styles.result}
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
          <Text style={styles.result100}>
            {kcal === null || kcal === undefined ? '— kcal' : `${Math.round(kcal)} kcal`} · P{' '}
            {fmt(computed.result.per100g.proteinGrams)} · C{' '}
            {fmt(computed.result.per100g.carbohydrateGrams)} · G{' '}
            {fmt(computed.result.per100g.fatGrams)}
          </Text>
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
  return value === null || value === undefined ? '— g' : `${Math.round(value * 10) / 10} g`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: 'row', gap: spacing.md },
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
      minHeight: 48,
      padding: spacing.md,
    },
    ingredientRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    ingredientName: { ...typography.body, color: colors.text, flex: 1 },
    gramsInput: { marginBottom: 0, minWidth: 80, textAlign: 'right' },
    unit: { ...typography.body, color: colors.textMuted },
    remove: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
    result: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 48 },
    resultText: { ...typography.body, color: colors.text },
    result100: { ...typography.title, color: colors.text },
    hint: { ...typography.caption, color: colors.textMuted },
    error: { ...typography.caption, color: colors.danger },
  });
}
