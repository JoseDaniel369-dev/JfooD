import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSQLiteContext } from 'expo-sqlite';

import { ActionSheet } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WeekStrip } from '@/components/WeekStrip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Fab } from '@/components/Fab';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import { getLatestGoals } from '@/data/sqlite/repositories/goalsRepository';
import {
  copyPlanDay,
  copyPlanToDiary,
  duplicatePlanEntry,
  movePlanEntry,
  removePlanEntry,
  restorePlanEntry,
  updatePlanEntryGrams,
  type PlanEntrySnapshot,
} from '@/data/sqlite/repositories/planRepository';
import { countDiaryEntries } from '@/data/sqlite/repositories/diaryRepository';
import { updateEntryNutrients } from '@/data/sqlite/repositories/entryNutrientsRepository';
import { GramsEditorModal } from '@/features/diary/components/GramsEditorModal';
import { NutrientsEditorModal } from '@/features/diary/components/NutrientsEditorModal';
import { MealList } from '@/features/diary/components/MealList';
import { addDays, formatLocalDate } from '@/features/diary/utils/date';
import { currentDefaultMeal } from '@/features/diary/utils/meals';
import { describeUnknown, formatPartialAmount } from '@/features/diary/utils/totals';
import { hapticSuccess, hapticWarning } from '@/features/haptics/haptics';
import { usePlanDay } from '@/features/plan/hooks/usePlanDay';
import { usePlanWeekOverview } from '@/features/plan/hooks/usePlanWeekOverview';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';
import type { PartialNutrient } from '@jfood/core';
import type { DiaryEntry, MealType } from '@/features/diary/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
};

export default function PlannerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const database = useSQLiteContext();
  const { day, error, loading, localDate, setLocalDate, reload, refresh } =
    usePlanDay();
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [activeEntry, setActiveEntry] = useState<DiaryEntry | null>(null);
  const [completingEntry, setCompletingEntry] = useState<DiaryEntry | null>(null);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [existingDiaryEntries, setExistingDiaryEntries] = useState(0);

  const weekData = usePlanWeekOverview(
    localDate,
    day ? `${day.entries.length}|${day.consumedPartial.caloriesKcal.knownTotal}` : '',
  );

  // The calorie goal gives each day of the strip its progress ring.
  const [goalKcal, setGoalKcal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getLatestGoals(database, localDate)
      .then(({ goals }) => {
        if (!cancelled) setGoalKcal(goals.caloriesKcal);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [database, localDate]);

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
        showToast('No se ha podido mover la entrada.', 'error');
      }
    })();
  };

  const undoDelete = async (snapshot: PlanEntrySnapshot) => {
    try {
      await restorePlanEntry(database, snapshot);
      await refresh();
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
        const snapshot = await removePlanEntry(database, entry.id);
        await refresh();
        hapticWarning();
        if (snapshot) {
          showToast('Entrada eliminada del plan.', 'success', {
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
        await duplicatePlanEntry(database, entry.id);
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
      await updateEntryNutrients(database, 'plan_entries', completingEntry.id, values, {
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
      await updatePlanEntryGrams(database, editingEntry.id, grams);
      setEditingEntry(null);
      await refresh();
      hapticSuccess();
      showToast('Cantidad actualizada.');
    } catch {
      showToast('No se ha podido actualizar la cantidad.', 'error');
    }
  };

  const openCopyConfirm = async () => {
    try {
      setExistingDiaryEntries(await countDiaryEntries(database, localDate));
    } catch {
      setExistingDiaryEntries(0);
    }
    setShowCopyConfirm(true);
  };

  // A second tap while copying would duplicate every entry.
  const copyingRef = useRef(false);

  const handleDuplicateToNextDay = async () => {
    if (copyingRef.current) return;
    copyingRef.current = true;
    try {
      const target = addDays(localDate, 1);
      const count = await copyPlanDay(database, localDate, target);
      hapticSuccess();
      showToast(`Se han duplicado ${count} entrada(s) en el día siguiente.`);
      setLocalDate(target);
    } catch {
      showToast('No se ha podido duplicar el día.', 'error');
    } finally {
      copyingRef.current = false;
    }
  };

  const handleCopyToDiary = async () => {
    setShowCopyConfirm(false);
    if (!day || day.entries.length === 0) return;
    if (copyingRef.current) return;
    copyingRef.current = true;

    try {
      await copyPlanToDiary(database, localDate);
      hapticSuccess();
      showToast('El día se ha copiado al diario.');
    } catch {
      showToast('No se ha podido copiar el plan al diario.', 'error');
    } finally {
      copyingRef.current = false;
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

  return (
    <Screen fab>
      <ScreenHeader
        title="Planificador"
        subtitle={formatLocalDate(localDate)}
      />

      <View style={styles.swipeContainer}>
        <Card animated>
          <WeekStrip
            data={weekData}
            goalKcal={goalKcal}
            onSelect={setLocalDate}
            selectedDate={localDate}
          />
        </Card>

        <Card animated delay={50}>
          <SectionHeader title="Totales del día" />
          <View style={styles.totalRow}>
            <TotalItem
              color={colors.primary}
              label="Calorías"
              unit="kcal"
              value={day.consumedPartial.caloriesKcal}
            />
            <TotalItem
              color={colors.protein}
              label="Proteínas"
              unit="g"
              value={day.consumedPartial.proteinGrams}
            />
            <TotalItem
              color={colors.carbohydrates}
              label="Carbos"
              unit="g"
              value={day.consumedPartial.carbohydrateGrams}
            />
            <TotalItem
              color={colors.fat}
              label="Grasas"
              unit="g"
              value={day.consumedPartial.fatGrams}
            />
          </View>
        </Card>

        {describeUnknown(day.consumedPartial.caloriesKcal) ? (
          <Text style={styles.unknownNotice}>
            {describeUnknown(day.consumedPartial.caloriesKcal)}: los totales son
            un mínimo.
          </Text>
        ) : null}

        <Card animated delay={100}>
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
              onAction={() => handleAddFood(currentDefaultMeal())}
            />
          ) : (
            <MealList
              meals={day.meals}
              variant="detailed"
              onAddFood={handleAddFood}
              onEntryDelete={handleDelete}
              onEntryDuplicate={handleDuplicate}
              onEntryPress={handleEntryPress}
            />
          )}
        </Card>

        {day.entries.length > 0 ? (
          <Button
            icon="duplicate-outline"
            title="Duplicar al día siguiente"
            variant="secondary"
            onPress={() => void handleDuplicateToNextDay()}
          />
        ) : null}

        {day.entries.length > 0 ? (
          <Button
            icon="copy-outline"
            title="Copiar al diario"
            variant="accent"
            onPress={() => void openCopyConfirm()}
          />
        ) : null}
      </View>

      <Fab accessibilityLabel="Añadir alimento" onPress={() => handleAddFood(currentDefaultMeal())} />

      <ActionSheet
        options={actionOptions}
        title={activeEntry?.foodName}
        visible={activeEntry !== null}
        onClose={() => setActiveEntry(null)}
      />

      <ConfirmDialog
        confirmLabel="Copiar"
        message={
          existingDiaryEntries > 0
            ? `El diario de este día ya tiene ${existingDiaryEntries} entrada(s). Se añadirán ${day.entries.length} más del plan, así que podrían duplicarse. El plan no se borrará.`
            : `Se añadirán ${day.entries.length} entrada(s) del plan al diario. El plan no se borrará.`
        }
        title="Copiar al diario"
        visible={showCopyConfirm}
        onClose={() => setShowCopyConfirm(false)}
        onConfirm={handleCopyToDiary}
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

function TotalItem({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: PartialNutrient;
  unit: string;
  color: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.totalItem}>
      <View style={[styles.totalDot, { backgroundColor: color }]} />
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>
        {formatPartialAmount(value)}
        <Text style={styles.totalUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    swipeContainer: {
      gap: spacing.lg,
    },
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
    unknownNotice: {
      ...typography.caption,
      color: colors.warning,
      textAlign: 'center',
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
}
