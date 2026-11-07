import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useSQLiteContext } from 'expo-sqlite';

import { ActionSheet } from '@/components/ActionSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DayNavigator } from '@/components/DayNavigator';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/Button';
import {
  copyPlanToDiary,
  deletePlanEntry,
  movePlanEntry,
  updatePlanEntryGrams,
} from '@/data/sqlite/repositories/planRepository';
import { GramsEditorModal } from '@/features/diary/components/GramsEditorModal';
import { MealList } from '@/features/diary/components/MealList';
import { addDays, toLocalDate } from '@/features/diary/utils/date';
import { usePlanDay } from '@/features/plan/hooks/usePlanDay';
import { colors, radius, spacing, typography } from '@/theme';
import type { DiaryEntry, MealType } from '@/features/diary/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
};

export default function PlannerScreen() {
  const database = useSQLiteContext();
  const { day, error, loading, localDate, setLocalDate, reload, refresh } =
    usePlanDay();
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [activeEntry, setActiveEntry] = useState<DiaryEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<DiaryEntry | null>(null);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);

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
      params: { date: localDate, meal: mealType, target: 'plan' },
    });
  };

  const handleEntryPress = (entry: DiaryEntry) => {
    setActiveEntry(entry);
  };

  const handleMove = (entry: DiaryEntry, targetMealType: MealType) => {
    setActiveEntry(null);
    void (async () => {
      try {
        await movePlanEntry(database, entry.id, localDate, targetMealType);
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
        await deletePlanEntry(database, entry.id);
        await refresh();
      } catch {
        Alert.alert('Error', 'No se ha podido eliminar la entrada.');
      }
    })();
  };

  const handleSaveGrams = async (grams: number) => {
    if (!editingEntry) return;

    try {
      await updatePlanEntryGrams(database, editingEntry.id, grams);
      setEditingEntry(null);
      await refresh();
    } catch {
      Alert.alert('Error', 'No se ha podido actualizar la cantidad.');
    }
  };

  const handleCopyToDiary = async () => {
    setShowCopyConfirm(false);
    if (!day || day.entries.length === 0) return;

    try {
      await copyPlanToDiary(database, localDate);
      Alert.alert('Listo', 'El día se ha copiado al diario.');
    } catch {
      Alert.alert('Error', 'No se ha podido copiar el plan al diario.');
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

  return (
    <Screen>
      <ScreenHeader
        title="Planificador"
        subtitle="Organiza tus comidas por días"
      />

      <Card>
        <DayNavigator
          date={localDate}
          onNext={handleNextDay}
          onPrevious={handlePreviousDay}
          onToday={handleToday}
        />
      </Card>

      <Card>
        <SectionHeader title="Totales del día" />
        <View style={styles.totalRow}>
          <TotalItem
            color={colors.primary}
            label="Calorías"
            unit="kcal"
            value={day.consumed.caloriesKcal}
          />
          <TotalItem
            color={colors.protein}
            label="Proteínas"
            unit="g"
            value={day.consumed.proteinGrams}
          />
          <TotalItem
            color={colors.carbohydrates}
            label="Carbos"
            unit="g"
            value={day.consumed.carbohydrateGrams}
          />
          <TotalItem
            color={colors.fat}
            label="Grasas"
            unit="g"
            value={day.consumed.fatGrams}
          />
        </View>
      </Card>

      <Card>
        <SectionHeader
          title="Comidas"
          caption={day.entries.length ? `${day.entries.length} alimento(s)` : undefined}
        />
        {day.entries.length === 0 ? (
          <EmptyState
            actionLabel="Añadir alimento"
            icon="restaurant-outline"
            message="Planifica tu primer alimento para este día."
            title="Día vacío"
            onAction={() => handleAddFood('breakfast')}
          />
        ) : (
          <MealList
            meals={day.meals}
            variant="detailed"
            onAddFood={handleAddFood}
            onEntryPress={handleEntryPress}
          />
        )}
      </Card>

      {day.entries.length > 0 ? (
        <Button
          icon="copy-outline"
          title="Copiar al diario"
          onPress={() => setShowCopyConfirm(true)}
        />
      ) : null}

      <ActionSheet
        options={actionOptions}
        title={activeEntry?.foodName}
        visible={activeEntry !== null}
        onClose={() => setActiveEntry(null)}
      />

      <ConfirmDialog
        confirmLabel="Copiar"
        message={`Se añadirán ${day.entries.length} entrada(s) del plan al diario. El plan no se borrará.`}
        title="Copiar al diario"
        visible={showCopyConfirm}
        onClose={() => setShowCopyConfirm(false)}
        onConfirm={handleCopyToDiary}
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

function TotalItem({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.totalItem}>
      <View style={[styles.totalDot, { backgroundColor: color }]} />
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>
        {value === null ? '—' : Math.round(value)}
        <Text style={styles.totalUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  totalRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  totalItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  totalDot: {
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  totalValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  totalUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
  },
});
