import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { useSQLiteContext } from 'expo-sqlite';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  deleteEntry,
  moveEntry,
  updateEntryGrams,
} from '@/data/sqlite/repositories/diaryRepository';
import { GramsEditorModal } from '@/features/diary/components/GramsEditorModal';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { formatLocalDate } from '@/features/diary/utils/date';
import { colors, radius, spacing } from '@/theme';
import type { DiaryEntry, MealType } from '@/features/diary/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
};

export default function DiaryScreen() {
  const database = useSQLiteContext();
  const { day, error, loading, localDate, reload, refresh } = useDiaryDay();
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);

  const handleAddFood = (mealType: MealType) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: mealType },
    });
  };

  const handleEntryPress = (entry: DiaryEntry) => {
    Alert.alert(entry.foodName, '¿Qué quieres hacer?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Editar gramos',
        onPress: () => setEditingEntry(entry),
      },
      {
        text: 'Mover de comida',
        onPress: () => showMoveOptions(entry),
      },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => confirmDelete(entry),
      },
    ]);
  };

  const showMoveOptions = (entry: DiaryEntry) => {
    const options = (
      Object.keys(MEAL_LABELS) as MealType[]
    ).filter((type) => type !== entry.mealType);

    Alert.alert(
      'Mover a',
      undefined,
      [
        { text: 'Cancelar', style: 'cancel' },
        ...options.map((type) => ({
          text: MEAL_LABELS[type],
          onPress: async () => {
            try {
              await moveEntry(database, entry.id, localDate, type);
              await refresh();
            } catch {
              Alert.alert('Error', 'No se ha podido mover la entrada.');
            }
          },
        })),
      ],
      { cancelable: true },
    );
  };

  const confirmDelete = (entry: DiaryEntry) => {
    Alert.alert(
      'Eliminar entrada',
      `¿Seguro que quieres eliminar "${entry.foodName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntry(database, entry.id);
              await refresh();
            } catch {
              Alert.alert('Error', 'No se ha podido eliminar la entrada.');
            }
          },
        },
      ],
      { cancelable: true },
    );
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
        title="Diario nutricional"
        subtitle={formatLocalDate(localDate)}
      />
      <Card>
        <Text style={styles.totalLabel}>Total consumido</Text>
        <Text style={styles.totalValue}>
          {day.consumed.caloriesKcal === null
            ? '—'
            : Math.round(day.consumed.caloriesKcal)}
          <Text style={styles.totalUnit}> kcal</Text>
        </Text>
      </Card>
      <Card>
        <MealList
          meals={day.meals}
          variant="detailed"
          onAddFood={handleAddFood}
          onEntryPress={handleEntryPress}
        />
      </Card>

      <Pressable
        accessibilityLabel="Añadir alimento rápidamente"
        accessibilityRole="button"
        onPress={() => handleAddFood('breakfast')}
        style={({ pressed }) => [
          styles.quickAddButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons color={colors.primary} name="add-circle-outline" size={22} />
        <Text style={styles.quickAddText}>Añadir alimento</Text>
      </Pressable>

      <Text style={styles.localNote}>
        Tu diario se guarda únicamente en este dispositivo y funciona sin
        conexión.
      </Text>

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

const styles = StyleSheet.create({
  totalLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  totalValue: {
    color: colors.primary,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  totalUnit: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '400',
  },
  quickAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  quickAddText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  localNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
