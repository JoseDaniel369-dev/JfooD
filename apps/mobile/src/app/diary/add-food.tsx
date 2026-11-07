import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { gramsSchema, nutrientsPer100gSchema } from '@jfood/core';
import { useSQLiteContext } from 'expo-sqlite';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { addEntry } from '@/data/sqlite/repositories/diaryRepository';
import { addPlanEntry } from '@/data/sqlite/repositories/planRepository';
import { toLocalDate } from '@/features/diary/utils/date';
import {
  createFood,
  getFavoriteFoods,
  getRecentFoods,
  searchFoods,
  toggleFavorite,
} from '@/data/sqlite/repositories/foodRepository';
import { MEALS, type MealType } from '@/features/diary/types';
import type { Food } from '@/features/foods/types';
import { colors, radius, spacing } from '@/theme';

type Step = 'search' | 'create' | 'quantity';

export default function AddFoodScreen() {
  const database = useSQLiteContext();
  const { date, meal, target } = useLocalSearchParams<{
    date?: string;
    meal?: string;
    target?: string;
  }>();
  const localDate = date ?? toLocalDate(new Date());
  const initialMeal = (MEALS.map((m) => m.type).includes(meal as MealType)
    ? meal
    : 'breakfast') as MealType;
  const isPlanTarget = target === 'plan';

  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [recents, setRecents] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [targetMeal, setTargetMeal] = useState<MealType>(initialMeal);
  const [saving, setSaving] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createBrand, setCreateBrand] = useState('');
  const [createCalories, setCreateCalories] = useState('');
  const [createProtein, setCreateProtein] = useState('');
  const [createCarbs, setCreateCarbs] = useState('');
  const [createFat, setCreateFat] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    const [favoriteRows, recentRows] = await Promise.all([
      getFavoriteFoods(database, 20),
      getRecentFoods(database, 10),
    ]);
    setFavorites(favoriteRows);
    setRecents(recentRows);
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      void loadLists();
    }, [loadLists]),
  );

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      const trimmed = text.trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const results = await searchFoods(database, trimmed, 20);
          setSearchResults(results);
        } finally {
          setSearching(false);
        }
      }, 200);
    },
    [database],
  );

  const handleSelectFood = (food: Food) => {
    setSelectedFood(food);
    setGrams('100');
    setStep('quantity');
  };

  const handleToggleFavorite = async (food: Food) => {
    try {
      await toggleFavorite(database, food.id);
      await loadLists();
      if (query.trim()) {
        const results = await searchFoods(database, query.trim(), 20);
        setSearchResults(results);
      }
    } catch {
      // Silently ignore; the user can retry.
    }
  };

  const handleCreateFood = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateError('El nombre es obligatorio.');
      return;
    }

    const calories = parseOptionalNumber(createCalories);
    const protein = parseOptionalNumber(createProtein);
    const carbs = parseOptionalNumber(createCarbs);
    const fat = parseOptionalNumber(createFat);

    if (!calories.valid || !protein.valid || !carbs.valid || !fat.valid) {
      setCreateError(
        'Revisa los valores nutricionales: deben ser números válidos o estar vacíos.',
      );
      return;
    }

    const macros = {
      caloriesKcal: calories.value,
      proteinGrams: protein.value,
      carbohydrateGrams: carbs.value,
      fatGrams: fat.value,
    };

    const parsedMacros = nutrientsPer100gSchema.safeParse(macros);
    if (!parsedMacros.success) {
      setCreateError('Revisa los valores nutricionales (deben ser 0 o mayores).');
      return;
    }

    setCreateError(null);

    try {
      const food = await createFood(database, {
        name,
        brand: createBrand.trim() || null,
        ...parsedMacros.data,
      });
      setSelectedFood(food);
      setGrams('100');
      setStep('quantity');
    } catch {
      setCreateError('No se ha podido crear el alimento.');
    }
  };

  const handleAddEntry = async () => {
    if (!selectedFood) return;

    const normalizedGrams = grams.replace(',', '.');
    const parsedGrams = Number(normalizedGrams);

    if (!gramsSchema.safeParse(parsedGrams).success) {
      Alert.alert(
        'Cantidad no válida',
        'Introduce una cantidad entre 1 y 100.000 gramos.',
      );
      return;
    }

    setSaving(true);

    try {
      if (isPlanTarget) {
        await addPlanEntry(database, {
          localDate,
          mealType: targetMeal,
          food: selectedFood,
          grams: parsedGrams,
        });
      } else {
        await addEntry(database, {
          localDate,
          mealType: targetMeal,
          food: selectedFood,
          grams: parsedGrams,
        });
      }
      router.back();
    } catch {
      setSaving(false);
      Alert.alert('Error', 'No se ha podido añadir la entrada.');
    }
  };

  const canAdd = useMemo(() => {
    const normalized = grams.replace(',', '.');
    const parsed = Number(normalized);
    return gramsSchema.safeParse(parsed).success;
  }, [grams]);

  return (
    <Screen>
      {step === 'search' ? (
        <>
          <ScreenHeader
            subtitle="Busca un alimento, crea uno nuevo o elige de tus favoritos."
            title="Añadir alimento"
          />
          <View style={styles.searchBar}>
            <Ionicons
              color={colors.textMuted}
              name="search-outline"
              size={20}
            />
            <TextInput
              autoFocus
              onChangeText={handleQueryChange}
              placeholder="Buscar alimentos..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')}>
                <Ionicons
                  color={colors.textMuted}
                  name="close-circle"
                  size={20}
                />
              </Pressable>
            ) : null}
          </View>

          {searching ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : query.trim() ? (
            <FoodSection
              foods={searchResults}
              emptyMessage="Ningún alimento coincide con tu búsqueda."
              title="Resultados"
              onSelect={handleSelectFood}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : (
            <>
              <FoodSection
                foods={favorites}
                emptyMessage="No tienes favoritos todavía."
                title="Favoritos"
                onSelect={handleSelectFood}
                onToggleFavorite={handleToggleFavorite}
              />
              <View style={styles.sectionSpacer} />
              <FoodSection
                foods={recents}
                emptyMessage="No has añadido alimentos recientemente."
                title="Recientes"
                onSelect={handleSelectFood}
                onToggleFavorite={handleToggleFavorite}
              />
            </>
          )}

          <Button
            icon="create-outline"
            title="Crear alimento nuevo"
            variant="secondary"
            onPress={() => setStep('create')}
          />
        </>
      ) : null}

      {step === 'create' ? (
        <>
          <ScreenHeader
            subtitle="Introduce los datos del alimento por cada 100 g."
            title="Crear alimento"
          />
          <View style={styles.form}>
            <FormField label="Nombre *" value={createName} onChange={setCreateName} />
            <FormField
              label="Marca (opcional)"
              value={createBrand}
              onChange={setCreateBrand}
            />
            <MacroField
              label="Calorías (kcal / 100 g)"
              value={createCalories}
              onChange={setCreateCalories}
            />
            <View style={styles.macroRow}>
              <MacroField
                label="Proteínas (g)"
                value={createProtein}
                onChange={setCreateProtein}
              />
              <MacroField
                label="Carbohidratos (g)"
                value={createCarbs}
                onChange={setCreateCarbs}
              />
              <MacroField
                label="Grasas (g)"
                value={createFat}
                onChange={setCreateFat}
              />
            </View>
            {createError ? (
              <Text style={styles.errorText}>{createError}</Text>
            ) : null}
          </View>

          <View style={styles.buttonRow}>
            <View style={styles.buttonFlex}>
              <Button title="Volver" variant="secondary" onPress={() => setStep('search')} />
            </View>
            <View style={styles.buttonFlex}>
              <Button title="Continuar" onPress={handleCreateFood} />
            </View>
          </View>
        </>
      ) : null}

      {step === 'quantity' && selectedFood ? (
        <>
          <ScreenHeader
            subtitle={`Valores por 100 g de ${selectedFood.name}`}
            title="Cantidad"
          />
          <View style={styles.foodSummary}>
            <Text style={styles.foodName}>{selectedFood.name}</Text>
            {selectedFood.brand ? (
              <Text style={styles.foodBrand}>{selectedFood.brand}</Text>
            ) : null}
            <Text style={styles.foodMacros}>
              {formatMacro(selectedFood.caloriesKcal, 'kcal')} ·{' '}
              {formatMacro(selectedFood.proteinGrams, 'P')} ·{' '}
              {formatMacro(selectedFood.carbohydrateGrams, 'C')} ·{' '}
              {formatMacro(selectedFood.fatGrams, 'G')}
            </Text>
          </View>

          <View style={styles.form}>
            <FormField
              label="Cantidad (g)"
              value={grams}
              onChange={setGrams}
            />

            <Text style={styles.label}>Comida</Text>
            <View style={styles.mealOptions}>
              {MEALS.map(({ type, label }) => (
                <Pressable
                  key={type}
                  onPress={() => setTargetMeal(type)}
                  style={[
                    styles.mealOption,
                    targetMeal === type && styles.mealOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.mealOptionText,
                      targetMeal === type && styles.mealOptionTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.buttonRow}>
            <View style={styles.buttonFlex}>
              <Button title="Volver" variant="secondary" onPress={() => setStep('search')} />
            </View>
            <View style={styles.buttonFlex}>
              <Button
                disabled={!canAdd || saving}
                loading={saving}
                title="Añadir"
                onPress={handleAddEntry}
              />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function FoodSection({
  foods,
  title,
  emptyMessage,
  onSelect,
  onToggleFavorite,
}: {
  foods: Food[];
  title: string;
  emptyMessage: string;
  onSelect: (food: Food) => void;
  onToggleFavorite: (food: Food) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {foods.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : (
        foods.map((food) => (
          <View key={food.id} style={styles.foodRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect(food)}
              style={({ pressed }) => [
                styles.foodInfo,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodMacros}>
                {formatMacro(food.caloriesKcal, 'kcal')} ·{' '}
                {formatMacro(food.proteinGrams, 'P')} ·{' '}
                {formatMacro(food.carbohydrateGrams, 'C')} ·{' '}
                {formatMacro(food.fatGrams, 'G')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={
                food.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'
              }
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onToggleFavorite(food)}
              style={({ pressed }) => [
                styles.favoriteButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={food.isFavorite ? colors.accent : colors.textMuted}
                name={food.isFavorite ? 'star' : 'star-outline'}
                size={22}
              />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        onChangeText={onChange}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.macroField}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={onChange}
        style={styles.input}
        value={value}
      />
    </View>
  );
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

function formatMacro(value: number | null, unit: string): string {
  return value === null ? `— ${unit}` : `${value} ${unit}`;
}

const styles = StyleSheet.create({
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    padding: spacing.sm,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 120,
  },
  section: {
    gap: spacing.sm,
  },
  sectionSpacer: {
    height: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  foodRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  foodInfo: {
    flex: 1,
    gap: 2,
  },
  foodName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  foodBrand: {
    color: colors.textMuted,
    fontSize: 13,
  },
  foodMacros: {
    color: colors.textMuted,
    fontSize: 12,
  },
  favoriteButton: {
    padding: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
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
  macroRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  macroField: {
    flex: 1,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 'auto',
  },
  buttonFlex: {
    flex: 1,
  },
  foodSummary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xl,
  },
  mealOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mealOption: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  mealOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mealOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  mealOptionTextSelected: {
    color: colors.textOnPrimary,
  },
  pressed: {
    opacity: 0.75,
  },
});
