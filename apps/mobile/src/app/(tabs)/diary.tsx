import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useSQLiteContext } from 'expo-sqlite';

import { ActionSheet } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { CalorieHero } from '@/components/CalorieHero';
import { Card } from '@/components/Card';
import { WeekStrip } from '@/components/WeekStrip';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import {
  copyDiaryDay,
  duplicateEntry,
  moveEntry,
  removeEntry,
  restoreEntry,
  updateEntryGrams,
  type EntrySnapshot,
} from '@/data/sqlite/repositories/diaryRepository';
import { updateEntryNutrients } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { CopyMealSheet } from '@/features/diary/components/CopyMealSheet';
import { GramsEditorModal } from '@/features/diary/components/GramsEditorModal';
import { NutrientsEditorModal } from '@/features/diary/components/NutrientsEditorModal';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { useWeekOverview } from '@/features/diary/hooks/useWeekOverview';
import { addDays, formatLocalDate, isValidLocalDate } from '@/features/diary/utils/date';
import { describeExtras } from '@/features/diary/utils/totals';
import { fadeUp } from '@/features/motion/springs';
import { hapticSuccess, hapticWarning } from '@/features/haptics/haptics';
import { scheduleReminders } from '@/features/reminders/notifications';
import { spacing, useTheme, type ThemeColors } from '@/theme';
import type { DiaryEntry, MealType } from '@/features/diary/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
};

export default function DiaryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const database = useSQLiteContext();
  const { day, error, loading, localDate, setLocalDate, reload, refresh } =
    useDiaryDay();
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [activeEntry, setActiveEntry] = useState<DiaryEntry | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<MealType | null>(null);
  const [completingEntry, setCompletingEntry] = useState<DiaryEntry | null>(null);
  const copyingRef = useRef(false);

  // Opened from the Inicio week strip with a day to show.
  // `t` changes on every tap, so choosing the same day again still applies.
  const { date: dateParam, t: tapStamp } = useLocalSearchParams<{ date?: string; t?: string }>();
  useEffect(() => {
    if (dateParam && isValidLocalDate(dateParam)) {
      setLocalDate(dateParam);
    }
  }, [dateParam, tapStamp, setLocalDate]);

  const weekData = useWeekOverview(
    localDate,
    day ? `${day.entries.length}|${day.consumedPartial.caloriesKcal.knownTotal}` : '',
  );

  const handleAddFood = (mealType: MealType) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: mealType },
    });
  };

  const handleRepeatYesterday = async () => {
    // A second tap while copying would duplicate every entry.
    if (copyingRef.current) return;
    copyingRef.current = true;
    try {
      const count = await copyDiaryDay(database, addDays(localDate, -1), localDate);
      if (count === 0) {
        showToast('No hay comidas registradas el día anterior.', 'error');
        return;
      }
      await refresh();
      void scheduleReminders(database);
      hapticSuccess();
      showToast(`Se han copiado ${count} alimento(s) del día anterior.`);
    } catch {
      showToast('No se han podido copiar las comidas.', 'error');
    } finally {
      copyingRef.current = false;
    }
  };

  const handleEntryPress = (entry: DiaryEntry) => {
    setActiveEntry(entry);
  };

  const handleMove = (entry: DiaryEntry, targetMealType: MealType) => {
    setActiveEntry(null);
    void (async () => {
      try {
        await moveEntry(database, entry.id, localDate, targetMealType);
        await refresh();
      } catch {
        showToast('No se ha podido mover la entrada.', 'error');
      }
    })();
  };

  const undoDelete = async (snapshot: EntrySnapshot) => {
    try {
      await restoreEntry(database, snapshot);
      await refresh();
      void scheduleReminders(database);
      hapticSuccess();
    } catch {
      showToast('No se ha podido deshacer.', 'error');
    }
  };

  // Deleting never asks "are you sure?": it offers to undo instead.
  const handleDelete = (entry: DiaryEntry) => {
    setActiveEntry(null);

    void (async () => {
      try {
        const snapshot = await removeEntry(database, entry.id);
        await refresh();
        void scheduleReminders(database);
        hapticWarning();
        if (snapshot) {
          showToast('Entrada eliminada.', 'success', {
            label: 'Deshacer',
            onPress: () => void undoDelete(snapshot),
          });
        }
      } catch {
        showToast('No se ha podido eliminar la entrada.', 'error');
      }
    })();
  };

  const handleDuplicate = (entry: DiaryEntry) => {
    setActiveEntry(null);

    void (async () => {
      try {
        await duplicateEntry(database, entry.id);
        await refresh();
        hapticSuccess();
        showToast('Entrada duplicada.');
      } catch {
        showToast('No se ha podido duplicar la entrada.', 'error');
      }
    })();
  };

  const handleSaveNutrients = async (
    values: Parameters<typeof updateEntryNutrients>[3],
    alsoUpdateFood: boolean,
  ): Promise<string | null> => {
    if (!completingEntry) return null;

    try {
      await updateEntryNutrients(database, 'diary_entries', completingEntry.id, values, {
        alsoUpdateFood,
      });
      setCompletingEntry(null);
      await refresh();
      hapticSuccess();
      showToast('Valores nutricionales actualizados.');
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'No se han podido guardar los valores.';
    }
  };

  const handleSaveGrams = async (grams: number) => {
    if (!editingEntry) return;

    try {
      await updateEntryGrams(database, editingEntry.id, grams);
      setEditingEntry(null);
      await refresh();
      hapticSuccess();
      showToast('Cantidad actualizada.');
    } catch {
      showToast('No se ha podido actualizar la cantidad.', 'error');
    }
  };

  const handleCopyMeal = async (targetDate: string) => {
    const meal = copyingMeal;
    if (!meal) return;

    try {
      const count = await copyDiaryDay(database, localDate, targetDate, meal);
      setCopyingMeal(null);
      if (count === 0) {
        showToast('Esa comida no tiene alimentos que copiar.', 'error');
        return;
      }
      void scheduleReminders(database);
      hapticSuccess();
      showToast(`Copiado a ${formatLocalDate(targetDate)} (${count}).`, 'success', {
        label: 'Ver día',
        onPress: () => setLocalDate(targetDate),
      });
    } catch {
      // Close the sheet first: a toast would stay hidden under it.
      setCopyingMeal(null);
      showToast('No se ha podido copiar la comida.', 'error');
    }
  };

  const moveOptions = activeEntry
    ? (Object.keys(MEAL_LABELS) as MealType[])
        .filter((type) => type !== activeEntry.mealType)
        .map((type) => ({
          label: MEAL_LABELS[type],
          icon: 'arrow-forward-outline' as const,
          onPress: () => handleMove(activeEntry, type),
        }))
    : [];

  const actionOptions = activeEntry
    ? [
        {
          label: 'Editar gramos',
          icon: 'create-outline' as const,
          onPress: () => {
            setActiveEntry(null);
            setEditingEntry(activeEntry);
          },
        },
        {
          label: hasUnknownNutrients(activeEntry)
            ? 'Completar datos nutricionales'
            : 'Editar valores nutricionales',
          icon: 'nutrition-outline' as const,
          onPress: () => {
            setActiveEntry(null);
            setCompletingEntry(activeEntry);
          },
        },
        {
          label: 'Duplicar',
          icon: 'copy-outline' as const,
          onPress: () => handleDuplicate(activeEntry),
        },
        ...moveOptions,
        {
          label: 'Eliminar',
          icon: 'trash-outline' as const,
          destructive: true,
          onPress: () => handleDelete(activeEntry),
        },
      ]
    : [];

  if (loading) {
    return (
      <Screen fab>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !day) {
    return (
      <Screen fab>
        <ErrorState
          message={error ?? 'No hay datos disponibles.'}
          onRetry={() => void reload()}
        />
      </Screen>
    );
  }

  const kcal = day.consumedPartial.caloriesKcal;
  const extras = describeExtras(
    day.consumedPartial,
    day.targets,
    day.entries.length > 0,
  );

  return (
    <Screen fab>
      <ScreenHeader
        title="Diario nutricional"
        subtitle={formatLocalDate(localDate)}
      />

      <View style={styles.swipeContainer}>
        <Card animated>
          <WeekStrip
            data={weekData}
            goalKcal={day.goals.caloriesKcal}
            onSelect={setLocalDate}
            selectedDate={localDate}
          />
        </Card>

        <Animated.View entering={fadeUp(50)}>
          <CalorieHero
            extras={extras}
            goalKcal={day.goals.caloriesKcal}
            goalsAreDefault={day.goalsAreDefault}
            kcal={kcal}
          />
        </Animated.View>

        {day.entries.length === 0 ? (
          <Button
            icon="copy-outline"
            title="Repetir comidas del día anterior"
            variant="secondary"
            onPress={() => void handleRepeatYesterday()}
          />
        ) : null}

        <Card animated delay={100}>
          <SectionHeader
            title="Comidas"
            caption={day.entries.length ? `${day.entries.length} alimento(s)` : undefined}
          />
          <MealList
            meals={day.meals}
            variant="detailed"
            onAddFood={handleAddFood}
            onMealCopy={setCopyingMeal}
            onEntryDelete={handleDelete}
            onEntryDuplicate={handleDuplicate}
            onEntryPress={handleEntryPress}
          />
        </Card>
      </View>


      <CopyMealSheet
        fromDate={localDate}
        mealLabel={copyingMeal ? MEAL_LABELS[copyingMeal].toLowerCase() : ''}
        onClose={() => setCopyingMeal(null)}
        onCopy={handleCopyMeal}
        visible={copyingMeal !== null}
      />

      <ActionSheet
        options={actionOptions}
        title={activeEntry?.foodName}
        visible={activeEntry !== null}
        onClose={() => setActiveEntry(null)}
      />

      {completingEntry ? (
        <NutrientsEditorModal
          key={completingEntry.id}
          canUpdateFood
          foodName={completingEntry.foodName}
          initial={completingEntry.per100g}
          onClose={() => setCompletingEntry(null)}
          onSave={handleSaveNutrients}
          visible
        />
      ) : null}

      {editingEntry ? (
        <GramsEditorModal
          key={editingEntry.id}
          foodName={editingEntry.foodName}
          initialGrams={editingEntry.grams}
          onClose={() => setEditingEntry(null)}
          onSave={handleSaveGrams}
          visible
        />
      ) : null}
    </Screen>
  );
}

function hasUnknownNutrients(entry: DiaryEntry): boolean {
  return Object.values(entry.per100g).some((value) => value === null);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    swipeContainer: {
      gap: spacing.lg,
    },
  });
}
