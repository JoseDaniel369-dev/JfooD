import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import {
  MEALS,
  type DiaryEntry,
  type MealSummary,
  type MealType,
} from '@/features/diary/types';

interface MealListProps {
  meals: Record<MealType, MealSummary>;
  variant?: 'summary' | 'detailed';
  onAddFood?: (mealType: MealType) => void;
  onEntryPress?: (entry: DiaryEntry) => void;
}

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  snack: 'cafe-outline',
  dinner: 'moon-outline',
};

export function MealList({
  meals,
  variant = 'summary',
  onAddFood,
  onEntryPress,
}: MealListProps) {
  return (
    <View style={styles.list}>
      {MEALS.map(({ type, label }, index) => {
        const meal = meals[type];
        const calories = meal.nutrients.caloriesKcal;
        const isDetailed = variant === 'detailed';

        return (
          <View key={type}>
            {index > 0 ? <View style={styles.separator} /> : null}
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <Ionicons
                  color={colors.primary}
                  name={MEAL_ICONS[type]}
                  size={21}
                />
              </View>
              <View style={styles.mealCopy}>
                <Text style={styles.mealName}>{label}</Text>
                {isDetailed ? null : (
                  <Text numberOfLines={1} style={styles.mealDetails}>
                    {meal.entries.length
                      ? meal.entries.map((entry) => entry.foodName).join(', ')
                      : 'Sin alimentos registrados'}
                  </Text>
                )}
              </View>
              <View style={styles.mealActions}>
                <Text style={styles.calories}>
                  {calories === null ? '—' : Math.round(calories)}
                  <Text style={styles.unit}> kcal</Text>
                </Text>
                {isDetailed && onAddFood ? (
                  <Pressable
                    accessibilityLabel={`Añadir alimento a ${label}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => onAddFood(type)}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons color={colors.primary} name="add" size={22} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {isDetailed ? (
              <View style={styles.entries}>
                {meal.entries.length === 0 ? (
                  <Pressable
                    accessibilityLabel={`Añadir alimento a ${label}`}
                    accessibilityRole="button"
                    onPress={() => onAddFood?.(type)}
                    style={({ pressed }) => [
                      styles.emptyEntry,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.emptyEntryText}>
                      Añadir alimento
                    </Text>
                    <Ionicons
                      color={colors.primary}
                      name="add-circle-outline"
                      size={18}
                    />
                  </Pressable>
                ) : (
                  meal.entries.map((entry) => (
                    <Pressable
                      key={entry.id}
                      accessibilityLabel={`${entry.foodName}, ${entry.grams} gramos`}
                      accessibilityRole="button"
                      onPress={() => onEntryPress?.(entry)}
                      style={({ pressed }) => [
                        styles.entry,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.entryMain}>
                        <Text style={styles.entryName}>{entry.foodName}</Text>
                        <Text style={styles.entryGrams}>{entry.grams} g</Text>
                      </View>
                      <Text style={styles.entryCalories}>
                        {entry.per100g.caloriesKcal === null
                          ? '—'
                          : Math.round(
                              (entry.per100g.caloriesKcal * entry.grams) /
                                100,
                            )}
                        <Text style={styles.unit}> kcal</Text>
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.lg,
  },
  separator: {
    backgroundColor: colors.border,
    height: 1,
    marginBottom: spacing.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  mealCopy: {
    flex: 1,
    gap: 3,
  },
  mealName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  mealDetails: {
    color: colors.textMuted,
    fontSize: 12,
  },
  mealActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  calories: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  unit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  entries: {
    gap: spacing.sm,
    marginLeft: 54,
    marginTop: spacing.sm,
  },
  entry: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  entryMain: {
    flex: 1,
    gap: 2,
  },
  entryName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  entryGrams: {
    color: colors.textMuted,
    fontSize: 12,
  },
  entryCalories: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyEntry: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.md,
  },
  emptyEntryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
