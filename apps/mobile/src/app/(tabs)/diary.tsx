import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useSQLiteContext } from 'expo-sqlite';

import { ActionSheet } from '@/components/ActionSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DayNavigator } from '@/components/DayNavigator';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/Button';
import {
  deleteEntry,
  moveEntry,
  updateEntryGrams,
} from '@/data/sqlite/repositories/diaryRepository';
import { GramsEditorModal } from '@/features/diary/components/GramsEditorModal';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { addDays, toLocalDate } from '@/features/diary/utils/date';
import { colors, spacing, typography } from '@/theme';
import type { DiaryEntry, MealType } from '@/features/diary/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
};

export default function DiaryScreen() {
  const database = useSQLiteContext();
  const { day, error, loading, localDate, setLocalDate, reload, refresh } =
    useDiaryDay();
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [activeEntry, setActiveEntry] = useState<DiaryEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<DiaryEntry | null>(null);

  const handlePreviousDay = () => {
    setLocalDate((current) => addDays(current, -1));
  };

  const handleNextDay = () => {
    setLocalDate((current) => addDays(current, 1));
  };

  const handleToday = () => {
    setLocalDate(toLocalDate(new Date()));
  };

  const handleAddFood = (mealType: MealType) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: mealType },
    });
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
        Alert.alert('Error', 'No se ha podido mover la entrada.');
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
        await deleteEntry(database, entry.id);
        await refresh();
      } catch {
        Alert.alert('Error', 'No se ha podido eliminar la entrada.');
      }
    })();
  };

  const handleSaveGrams = async (grams: number) => {
    if (!editingEntry) return;

    try {
      await updateEntryGrams(database, editingEntry.id, grams);
      setEditingEntry(null);
      await refresh();
    } catch {
      Alert.alert('Error', 'No se ha podido actualizar la cantidad.');
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
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !day) {
    return (
      <Screen>
        <ErrorState
          message={error ?? 'No hay datos disponibles.'}
          onRetry={() => void reload()}
        />
      </Screen>
    );
  }

  const consumedCalories = day.consumed.caloriesKcal;
  const remainingCalories =
    consumedCalories === null
      ? null
      : day.goals.caloriesKcal - consumedCalories;
  const overGoal = remainingCalories !== null && remainingCalories < 0;

  return (
    <Screen>
      <ScreenHeader
        title="Diario nutricional"
        subtitle="Registra lo que comes cada día"
      />

      <Card>
        <DayNavigator
          date={localDate}
          onNext={handleNextDay}
          onPrevious={handlePreviousDay}
          onToday={handleToday}
        />
      </Card>

      <Card style={styles.calorieCard}>
        <View style={styles.calorieHeader}>
          <Text style={styles.cardLabel}>CALORÍAS</Text>
        </View>
        <View style={styles.calorieNumbers}>
          <Text style={styles.calorieValue}>
            {formatNumber(consumedCalories)}
          </Text>
          <Text style={styles.calorieGoal}>
            / {formatNumber(day.goals.caloriesKcal)} kcal
          </Text>
        </View>
        <View style={styles.calorieFooter}>
          <Text style={styles.calorieFooterLabel}>
            {overGoal ? 'Por encima del objetivo' : 'Restantes'}
          </Text>
          <Text style={styles.calorieFooterValue}>
            {remainingCalories === null
              ? '—'
              : `${formatNumber(Math.abs(remainingCalories))} kcal`}
          </Text>
        </View>
        {day.goalsAreDefault ? (
          <Text style={styles.goalNotice}>
            Objetivos provisionales: no calculados con tus datos personales.
          </Text>
        ) : null}
      </Card>

      <Card>
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

      <Button
        icon="add-circle-outline"
        title="Añadir alimento"
        onPress={() => handleAddFood('breakfast')}
      />

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

function formatNumber(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

const styles = StyleSheet.create({
  calorieCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calorieHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLabel: {
    color: colors.textOnPrimary,
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
    color: colors.textOnPrimary,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  calorieGoal: {
    color: colors.textOnPrimary,
    fontSize: 15,
    opacity: 0.7,
  },
  calorieFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calorieFooterLabel: {
    color: colors.textOnPrimary,
    fontSize: 13,
    opacity: 0.75,
  },
  calorieFooterValue: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  goalNotice: {
    color: colors.textOnPrimary,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.7,
  },
});
