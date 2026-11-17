import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useSQLiteContext } from 'expo-sqlite';

import { ActionSheet } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DayNavigator } from '@/components/DayNavigator';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import {
  copyDiaryDay,
  deleteEntry,
  moveEntry,
  updateEntryGrams,
} from '@/data/sqlite/repositories/diaryRepository';
import { updateEntryNutrients } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { GramsEditorModal } from '@/features/diary/components/GramsEditorModal';
import { NutrientsEditorModal } from '@/features/diary/components/NutrientsEditorModal';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { addDays, toLocalDate } from '@/features/diary/utils/date';
import {
  describeUnknown,
  formatPartialAmount,
  formatRemaining,
  remainingCalories,
  remainingLabel,
} from '@/features/diary/utils/totals';
import { hapticSuccess, hapticWarning } from '@/features/haptics/haptics';
import { animateNextLayout } from '@/features/motion/motion';
import { useSwipeDays } from '@/features/motion/useSwipeDays';
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
  const [entryToDelete, setEntryToDelete] = useState<DiaryEntry | null>(null);
  const [completingEntry, setCompletingEntry] = useState<DiaryEntry | null>(null);

  const handlePreviousDay = useCallback(() => {
    setLocalDate((current) => addDays(current, -1));
  }, [setLocalDate]);

  const handleNextDay = useCallback(() => {
    setLocalDate((current) => addDays(current, 1));
  }, [setLocalDate]);

  const handleToday = useCallback(() => {
    setLocalDate(toLocalDate(new Date()));
  }, [setLocalDate]);

  const swipe = useSwipeDays({
    onPrev: handlePreviousDay,
    onNext: handleNextDay,
  });

  const handleAddFood = (mealType: MealType) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: mealType },
    });
  };

  const handleRepeatYesterday = async () => {
    try {
      const count = await copyDiaryDay(database, addDays(localDate, -1), localDate);
      if (count === 0) {
        showToast('No hay comidas registradas el día anterior.', 'error');
        return;
      }
      await refresh();
      hapticSuccess();
      showToast(`Se han copiado ${count} alimento(s) del día anterior.`);
    } catch {
      showToast('No se han podido copiar las comidas.', 'error');
    }
  };

  const handleEntryPress = (entry: DiaryEntry) => {
    setActiveEntry(entry);
  };

  const handleMove = (entry: DiaryEntry, targetMealType: MealType) => {
    setActiveEntry(null);
    void (async () => {
      try {
        animateNextLayout();
        await moveEntry(database, entry.id, localDate, targetMealType);
        await refresh();
      } catch {
        showToast('No se ha podido mover la entrada.', 'error');
      }
    })();
  };

  const handleDelete = (entry: DiaryEntry) => {
    setActiveEntry(null);
    setEntryToDelete(entry);
  };

  const confirmDelete = () => {
    const entry = entryToDelete;
    setEntryToDelete(null);
    if (!entry) return;

    void (async () => {
      try {
        animateNextLayout();
        await deleteEntry(database, entry.id);
        await refresh();
        hapticWarning();
        showToast('Entrada eliminada.');
      } catch {
        showToast('No se ha podido eliminar la entrada.', 'error');
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
      animateNextLayout();
      await updateEntryGrams(database, editingEntry.id, grams);
      setEditingEntry(null);
      await refresh();
      hapticSuccess();
      showToast('Cantidad actualizada.');
    } catch {
      showToast('No se ha podido actualizar la cantidad.', 'error');
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

  return (
    <Screen fab>
      <ScreenHeader
        title="Diario nutricional"
        subtitle="Registra lo que comes cada día"
      />

      <Animated.View
        accessibilityHint="Desliza hacia los lados para cambiar de día"
        style={[
          styles.swipeContainer,
          { opacity: swipe.opacity, transform: [{ translateX: swipe.translateX }] },
        ]}
        {...swipe.panHandlers}
      >
        <Card animated>
          <DayNavigator
            date={localDate}
            onNext={handleNextDay}
            onPrevious={handlePreviousDay}
            onToday={handleToday}
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
            onEntryPress={handleEntryPress}
          />
        </Card>
      </Animated.View>


      <ActionSheet
        options={actionOptions}
        title={activeEntry?.foodName}
        visible={activeEntry !== null}
        onClose={() => setActiveEntry(null)}
      />

      <ConfirmDialog
        confirmLabel="Eliminar"
        destructive
        message={`¿Seguro que quieres eliminar "${entryToDelete?.foodName}"?`}
        title="Eliminar entrada"
        visible={entryToDelete !== null}
        onClose={() => setEntryToDelete(null)}
        onConfirm={confirmDelete}
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
    goalNotice: {
      color: colors.onHero,
      fontSize: 11,
      lineHeight: 16,
      opacity: 0.7,
    },
  });
}
