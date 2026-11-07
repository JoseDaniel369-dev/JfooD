import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSQLiteContext } from 'expo-sqlite';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  copyPlanToDiary,
  deletePlanEntry,
  movePlanEntry,
  updatePlanEntryGrams,
} from '@/data/sqlite/repositories/planRepository';
import { GramsEditorModal } from '@/features/diary/components/GramsEditorModal';
import { MealList } from '@/features/diary/components/MealList';
import { addDays, formatLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { usePlanDay } from '@/features/plan/hooks/usePlanDay';
import { colors, radius, spacing } from '@/theme';
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

  const today = toLocalDate(new Date());
  const isToday = localDate === today;

  const handlePreviousDay = () => {
    setLocalDate((current) => addDays(current, -1));
  };

  const handleNextDay = () => {
    setLocalDate((current) => addDays(current, 1));
  };

  const handleToday = () => {
    setLocalDate(today);
  };

  const handleAddFood = (mealType: MealType) => {
    router.push({
      pathname: '/diary/add-food',
      params: { date: localDate, meal: mealType, target: 'plan' },
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
              await movePlanEntry(database, entry.id, localDate, type);
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
              await deletePlanEntry(database, entry.id);
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
      await updatePlanEntryGrams(database, editingEntry.id, grams);
      setEditingEntry(null);
      await refresh();
    } catch {
      Alert.alert('Error', 'No se ha podido actualizar la cantidad.');
    }
  };

  const handleCopyToDiary = () => {
    if (!day || day.entries.length === 0) return;

    Alert.alert(
      'Copiar al diario',
      `Se añadirán ${day.entries.length} entrada(s) del ${formatLocalDate(localDate)} al diario. El plan no se borrará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Copiar',
          onPress: async () => {
            try {
              await copyPlanToDiary(database, localDate);
              Alert.alert('Listo', 'El día se ha copiado al diario.');
            } catch {
              Alert.alert('Error', 'No se ha podido copiar el plan al diario.');
            }
          },
        },
      ],
      { cancelable: true },
    );
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
        title="Planificador"
        subtitle="Organiza tus comidas por días"
      />

      <Card>
        <View style={styles.dateRow}>
          <Pressable
            accessibilityLabel="Día anterior"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handlePreviousDay}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.primary} name="chevron-back" size={24} />
          </Pressable>

          <View style={styles.dateInfo}>
            <Text style={styles.dateText}>{formatLocalDate(localDate)}</Text>
            {isToday ? <Text style={styles.todayBadge}>Hoy</Text> : null}
          </View>

          <Pressable
            accessibilityLabel="Día siguiente"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleNextDay}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          >
            <Ionicons
              color={colors.primary}
              name="chevron-forward"
              size={24}
            />
          </Pressable>
        </View>

        {!isToday ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleToday}
            style={({ pressed }) => [
              styles.todayButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.todayButtonText}>Volver a hoy</Text>
          </Pressable>
        ) : null}
      </Card>

      <Card>
        <MealList
          meals={day.meals}
          variant="detailed"
          onAddFood={handleAddFood}
          onEntryPress={handleEntryPress}
        />
      </Card>

      {day.entries.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleCopyToDiary}
          style={({ pressed }) => [
            styles.copyButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons color={colors.primary} name="copy-outline" size={22} />
          <Text style={styles.copyButtonText}>Copiar al diario</Text>
        </Pressable>
      ) : null}

      <Text style={styles.localNote}>
        El plan se guarda únicamente en este dispositivo y funciona sin
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
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dateInfo: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  dateText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  todayBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  todayButton: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  todayButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  copyButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  copyButtonText: {
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
