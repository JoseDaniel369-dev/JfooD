import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { isScannerEnabled } from '@/config/api';
import { getCatalogByCategory } from '@/data/sqlite/repositories/catalogRepository';
import { addEntry } from '@/data/sqlite/repositories/diaryRepository';
import {
  getFavoriteFoods,
  ensureFoodInLibrary,
  getFoodById,
  getFoodsByIds,
  getFrequentFoods,
  getRecentFoods,
  searchFoods,
  toggleFavorite,
} from '@/data/sqlite/repositories/foodRepository';
import { addPlanEntry } from '@/data/sqlite/repositories/planRepository';
import { MEALS, type MealType } from '@/features/diary/types';
import { formatLocalDate, isValidLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { CreateFoodForm } from '@/features/foods/components/CreateFoodForm';
import { FoodRow } from '@/features/foods/components/FoodRow';
import { QuantitySheet } from '@/features/foods/components/QuantitySheet';
import type { Food } from '@/features/foods/types';
import { FOOD_CATEGORIES } from '@/features/foods/utils/categories';
import { normalizeBarcode } from '@/features/foods/utils/openFoodFacts';
import { hapticSuccess } from '@/features/haptics/haptics';
import { scheduleReminders } from '@/features/reminders/notifications';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

type Tab = 'recents' | 'favorites' | 'frequent' | 'catalog';

const TAB_OPTIONS = [
  { value: 'recents', label: 'Recientes' },
  { value: 'favorites', label: 'Favoritos' },
  { value: 'frequent', label: 'Habituales' },
  { value: 'catalog', label: 'Catálogo' },
] as const;

/** Foods per page of a catalog category ("Ver más" loads the next page). */
const CATALOG_PAGE = 40;
/** Results of a search. Ranking puts the most useful first, so this is plenty. */
const SEARCH_LIMIT = 40;

export default function AddFoodScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const database = useSQLiteContext();
  const { date, meal, target, name, foodId, create, barcode } = useLocalSearchParams<{
    date?: string;
    meal?: string;
    target?: string;
    name?: string;
    foodId?: string;
    /** '1' opens the "create food" form directly. */
    create?: string;
    /** Barcode to store with a food created by hand. */
    barcode?: string;
  }>();

  // Route params can come from a deep link: never trust them as a date or meal.
  const localDate = date && isValidLocalDate(date) ? date : toLocalDate(new Date());
  const initialMeal: MealType = MEALS.some((m) => m.type === meal) ? (meal as MealType) : 'breakfast';
  const isPlanTarget = target === 'plan';
  const prefillName = name?.trim() ?? '';
  const pendingBarcode = barcode ? normalizeBarcode(barcode) : null;
  const mealLabel = MEALS.find((m) => m.type === initialMeal)?.label ?? '';

  const [creating, setCreating] = useState(Boolean(prefillName) || create === '1');
  /** Name typed in the search box when "Crear «X»" was tapped. */
  const [draftName, setDraftName] = useState('');
  /** Bumped when the screen regains focus, to refresh lists after edits elsewhere. */
  const [focusTick, setFocusTick] = useState(0);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Food[]>([]);
  const [recents, setRecents] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [frequents, setFrequents] = useState<Food[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [category, setCategory] = useState(FOOD_CATEGORIES[0]?.name ?? '');
  const [categoryFoods, setCategoryFoods] = useState<Food[]>([]);
  /** Foods of the big catalog for ONE category, loaded a page at a time. */
  const [catalogState, setCatalogState] = useState<{ category: string; foods: Food[]; hasMore: boolean }>({
    category: '',
    foods: [],
    hasMore: false,
  });
  // Pages of another category (a slow load that finished late) are never shown under this one.
  const catalogFoods = catalogState.category === category ? catalogState.foods : [];
  const catalogHasMore = catalogState.category === category && catalogState.hasMore;
  const [loadingMore, setLoadingMore] = useState(false);
  /** Set at once: a double tap on "Ver más" must load one page, not append it twice. */
  const loadingMoreRef = useRef(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuery = useRef('');

  // Opened from the barcode scanner (or a suggestion) with a food already chosen.
  useEffect(() => {
    if (!foodId) return;
    let cancelled = false;
    // A food from the barcode scanner or a suggestion may come from the big catalog.
    getFoodById(database, foodId)
      .then((food) => (food ? ensureFoodInLibrary(database, food) : null))
      .then((food) => {
        if (!cancelled && food) setSelected(food);
      })
      .catch(() => {
        // Falls back to the plain search screen.
      });
    return () => {
      cancelled = true;
    };
  }, [database, foodId]);

  const loadLists = useCallback(async () => {
    const [recentRows, favoriteRows, frequentRows] = await Promise.all([
      getRecentFoods(database, 12),
      getFavoriteFoods(database, 30),
      getFrequentFoods(database, 12),
    ]);
    setRecents(recentRows);
    setFavorites(favoriteRows);
    setFrequents(frequentRows);
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      void loadLists().catch(() => undefined);
      setFocusTick((tick) => tick + 1);
    }, [loadLists]),
  );

  // A food edited or deleted in its detail screen must not linger in the results.
  useEffect(() => {
    const current = latestQuery.current;
    if (!current) return;
    searchFoods(database, current, SEARCH_LIMIT)
      .then((found) => {
        if (latestQuery.current === current) setResults(found);
      })
      .catch(() => undefined);
  }, [database, focusTick]);

  // The built-in foods of the chosen category (they can change when a food is edited elsewhere).
  useEffect(() => {
    const ids = FOOD_CATEGORIES.find((c) => c.name === category)?.ids ?? [];
    let cancelled = false;
    getFoodsByIds(database, ids)
      .then((foods) => {
        if (!cancelled) setCategoryFoods(foods);
      })
      .catch(() => {
        if (!cancelled) setCategoryFoods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [database, category, focusTick]);

  // The big catalog, by popularity. Not tied to focusTick: coming back from a food's page
  // must not throw away the pages the person already loaded with "Ver más".
  useEffect(() => {
    let cancelled = false;
    getCatalogByCategory(database, category, CATALOG_PAGE, 0)
      .then((page) => {
        if (!cancelled) setCatalogState({ category, foods: page, hasMore: page.length === CATALOG_PAGE });
      })
      .catch(() => {
        if (!cancelled) setCatalogState({ category, foods: [], hasMore: false });
      });
    return () => {
      cancelled = true;
    };
  }, [database, category]);

  const loadMoreCatalog = async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const requested = category;
    setLoadingMore(true);
    try {
      const page = await getCatalogByCategory(database, requested, CATALOG_PAGE, catalogFoods.length);
      // Only if the person is still on the category this page belongs to.
      setCatalogState((current) =>
        current.category === requested
          ? { category: requested, foods: [...current.foods, ...page], hasMore: page.length === CATALOG_PAGE }
          : current,
      );
    } catch {
      showToast('No se han podido cargar más alimentos.', 'error');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  useEffect(
    () => () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    },
    [],
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      const trimmed = text.trim();
      latestQuery.current = trimmed;
      if (!trimmed) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const found = await searchFoods(database, trimmed, SEARCH_LIMIT);
          if (latestQuery.current === trimmed) setResults(found);
        } catch {
          if (latestQuery.current === trimmed) setResults([]);
        } finally {
          if (latestQuery.current === trimmed) setSearching(false);
        }
      }, 180);
    },
    [database],
  );

  const handleToggleFavorite = async (food: Food) => {
    try {
      // A catalog food enters the library the first time it is starred.
      const inLibrary = await ensureFoodInLibrary(database, food);
      // The value the database ended up with, not the opposite of what the screen showed.
      const isFavorite = await toggleFavorite(database, inLibrary.id);
      await loadLists();
      const flip = (list: Food[]) =>
        list.map((item) =>
          item.id === food.id || item.id === inLibrary.id ? { ...item, isFavorite } : item,
        );
      setResults(flip);
      setCategoryFoods(flip);
      setCatalogState((current) => ({ ...current, foods: flip(current.foods) }));
    } catch {
      // The star simply does not change; the person can try again.
    }
  };

  const handleSubmit = async (grams: number, mealType: MealType, keepOpen: boolean) => {
    if (!selected) return;

    try {
      if (isPlanTarget) {
        await addPlanEntry(database, { localDate, mealType, food: selected, grams });
      } else {
        await addEntry(database, { localDate, mealType, food: selected, grams });
        // The reminder for a meal that now has food is dropped.
        void scheduleReminders(database);
      }
    } catch {
      showToast('No se ha podido añadir la entrada.', 'error');
      return;
    }

    hapticSuccess();
    if (keepOpen) {
      setAddedCount((count) => count + 1);
      setSelected(null);
      showToast(`${selected.name} añadido.`);
      void loadLists().catch(() => undefined);
    } else {
      showToast(isPlanTarget ? 'Añadido al plan.' : 'Añadido al diario.');
      router.back();
    }
  };

  const openCreate = (name: string) => {
    setDraftName(name);
    setCreating(true);
  };

  /** Choosing a food copies it into the library first when it comes from the big catalog. */
  const handleSelect = async (food: Food) => {
    try {
      setSelected(await ensureFoodInLibrary(database, food));
    } catch {
      showToast('No se ha podido abrir el alimento.', 'error');
    }
  };

  const openInfo = async (food: Food) => {
    try {
      const inLibrary = await ensureFoodInLibrary(database, food);
      router.push({ pathname: '/foods/[id]', params: { id: inLibrary.id } });
    } catch {
      showToast('No se ha podido abrir el alimento.', 'error');
    }
  };
  const shortcutParams = { date: localDate, meal: initialMeal, target };

  if (creating) {
    return (
      <Screen>
        <Text style={styles.title}>Crear alimento</Text>
        <CreateFoodForm
          barcode={pendingBarcode}
          initialName={draftName || prefillName}
          onCancel={() => {
            setCreating(false);
            setDraftName('');
          }}
          onCreated={(food) => {
            hapticSuccess();
            showToast('Alimento creado.');
            setCreating(false);
            setSelected(food);
          }}
        />
      </Screen>
    );
  }

  const activeTab: Tab = tab ?? (recents.length > 0 ? 'recents' : 'catalog');
  const searchActive = query.trim() !== '';
  const listFor: Record<Tab, Food[]> = {
    recents,
    favorites,
    frequent: frequents,
    catalog: [...categoryFoods, ...catalogFoods],
  };
  const emptyText: Record<Tab, string> = {
    recents: 'Aún no has añadido alimentos.',
    favorites: 'Marca con ⭐ los alimentos que uses a menudo.',
    frequent: 'Aquí aparecerán los alimentos que más registras.',
    catalog: 'Este catálogo está vacío.',
  };
  const visible = searchActive ? results : listFor[activeTab];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Añadir alimento</Text>
          <Text style={styles.subtitle}>
            {isPlanTarget ? 'Al plan' : mealLabel} · {formatLocalDate(localDate)}
          </Text>
        </View>
        {addedCount > 0 ? (
          <Chip emoji="✅" label={`Listo (${addedCount})`} onPress={() => router.back()} selected />
        ) : null}
      </View>

      <View style={styles.searchBar}>
        <Ionicons color={colors.textMuted} name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Buscar alimentos"
          autoCorrect={false}
          onChangeText={handleQueryChange}
          placeholder="Buscar: pollo, arroz, manzana…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Borrar búsqueda"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => handleQueryChange('')}
          >
            <Ionicons color={colors.textMuted} name="close-circle" size={20} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.shortcuts}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        <Chip emoji="✏️" label="Crear" onPress={() => openCreate('')} />
        <Chip emoji="🍲" label="Receta" onPress={() => router.push('/recipe')} />
        {isScannerEnabled() ? (
          <>
            <Chip emoji="📷" label="Escanear" onPress={() => router.push({ pathname: '/scanner', params: shortcutParams })} />
            <Chip emoji="🔖" label="Código" onPress={() => router.push({ pathname: '/barcode', params: shortcutParams })} />
          </>
        ) : null}
      </ScrollView>

      {searchActive ? null : (
        <Segmented onChange={setTab} options={TAB_OPTIONS} value={activeTab} />
      )}

      {!searchActive && activeTab === 'catalog' ? (
        <ScrollView
          contentContainerStyle={styles.categories}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          {FOOD_CATEGORIES.map((item) => (
            <Chip
              key={item.name}
              emoji={item.emoji}
              label={item.name}
              onPress={() => setCategory(item.name)}
              selected={item.name === category}
            />
          ))}
        </ScrollView>
      ) : null}

      {searching ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {searchActive ? 'Ningún alimento coincide con tu búsqueda.' : emptyText[activeTab]}
          </Text>
          {searchActive ? (
            <Button
              icon="create-outline"
              title={`Crear «${query.trim()}»`}
              variant="secondary"
              onPress={() => openCreate(query.trim())}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
              onInfo={(item) => void openInfo(item)}
              onPress={(item) => void handleSelect(item)}
              onToggleFavorite={(item) => void handleToggleFavorite(item)}
            />
          ))}
          {!searchActive && activeTab === 'catalog' && catalogHasMore ? (
            <Button
              icon="chevron-down-outline"
              loading={loadingMore}
              title="Ver más alimentos"
              variant="secondary"
              onPress={() => void loadMoreCatalog()}
            />
          ) : null}
        </View>
      )}

      <QuantitySheet
        addedCount={addedCount}
        food={selected}
        forPlan={isPlanTarget}
        initialMeal={initialMeal}
        onClose={() => setSelected(null)}
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...typography.headline,
      color: colors.text,
      fontSize: 26,
    },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    searchBar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      paddingVertical: spacing.md,
    },
    shortcuts: {
      gap: spacing.sm,
    },
    categories: {
      gap: spacing.sm,
    },
    list: {
      gap: spacing.sm,
    },
    centered: {
      alignItems: 'center',
      minHeight: 120,
      justifyContent: 'center',
    },
    empty: {
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
