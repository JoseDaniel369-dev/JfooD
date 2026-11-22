import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSQLiteContext } from 'expo-sqlite';

import { ActionSheet } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
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
import {
  describeExtras,
  describeUnknown,
  formatPartialAmount,
  formatRemaining,
  remainingCalories,
  remainingLabel,
} from '@/features/diary/utils/totals';
import { hapticSuccess, hapticWarning } from '@/features/haptics/haptics';
import { scheduleReminders } from '@/features/reminders/notifications';
import { spacing, typography, useTheme, type ThemeColors } from '@/theme';
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
  const remaining = remainingCalories(day.goals.caloriesKcal, kcal);
  const unknownCaloriesNotice = describeUnknown(kcal);
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

        <Card animated delay={50} variant="hero">
          <Text style={styles.cardLabel}>CALORÍAS</Text>
          <View style={styles.calorieNumbers}>
            <Text style={styles.calorieValue}>
              {formatPartialAmount(kcal)}
            </Text>
            <Text style={styles.calorieGoal}>
              / {formatNumber(day.goals.caloriesKcal)} kcal
            </Text>
          </View>
          <View style={styles.calorieFooter}>
            <Text style={styles.calorieFooterLabel}>
              {remainingLabel(remaining)}
            </Text>
            <Text style={styles.calorieFooterValue}>
              {formatRemaining(remaining)}
            </Text>
          </View>
          {extras.length > 0 ? (
            <View style={styles.extrasRow}>
              {extras.map((extra) => (
                <View
                  key={extra.key}
                  accessibilityLabel={`${extra.label}: ${extra.amount} gramos, ${extra.target}`}
                  style={styles.extraItem}
                >
                  <Text style={styles.extraLabel}>{extra.label}</Text>
                  <Text
                    style={[styles.extraValue, extra.exceeded && styles.extraExceeded]}
                  >
                    {extra.amount} g
                  </Text>
                  <Text style={styles.extraTarget}>{extra.target}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {unknownCaloriesNotice ? (
            <Text style={styles.goalNotice}>
              {unknownCaloriesNotice}. Completa sus datos para ver el total real.
            </Text>
          ) : null}
          {day.goalsAreDefault ? (
            <Text style={styles.goalNotice}>
              Objetivos provisionales: no calculados con tus datos personales.
            </Text>
          ) : null}
        </Card>

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

function formatNumber(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    swipeContainer: {
      gap: spacing.lg,
    },
    cardLabel: {
      color: colors.onHero,
      fontSize: typography.label.fontSize,
      fontWeight: '700',
      letterSpacing: typography.label.letterSpacing,
      opacity: 0.75,
    },
    calorieNumbers: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    calorieValue: {
      color: colors.onHero,
      fontSize: 44,
      fontWeight: '700',
      letterSpacing: -1.5,
    },
    calorieGoal: {
      color: colors.onHero,
      fontSize: 15,
      opacity: 0.7,
    },
    calorieFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    calorieFooterLabel: {
      color: colors.onHero,
      fontSize: 13,
      opacity: 0.75,
    },
    calorieFooterValue: {
      color: colors.onHero,
      fontSize: 14,
      fontWeight: '700',
    },
    extrasRow: {
      borderTopColor: 'rgba(255,255,255,0.25)',
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    extraItem: {
      flex: 1,
      gap: 2,
    },
    extraLabel: {
      color: colors.onHero,
      fontSize: 11,
      fontWeight: '700',
      opacity: 0.75,
    },
    extraValue: {
      color: colors.onHero,
      fontSize: 15,
      fontWeight: '700',
    },
    extraExceeded: {
      textDecorationLine: 'underline',
    },
    extraTarget: {
      color: colors.onHero,
      fontSize: 10,
      opacity: 0.7,
    },
    goalNotice: {
      color: colors.onHero,
      fontSize: 11,
      lineHeight: 16,
      opacity: 0.7,
    },
  });
}
