import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { MEALS, type MealSummary, type MealType } from '@/features/diary/types';

interface MealListProps {
  meals: Record<MealType, MealSummary>;
}

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  snack: 'cafe-outline',
  dinner: 'moon-outline',
};

export function MealList({ meals }: MealListProps) {
  return (
    <View style={styles.list}>
      {MEALS.map(({ type, label }, index) => {
        const meal = meals[type];
        const calories = meal.nutrients.caloriesKcal;

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
                <Text numberOfLines={1} style={styles.mealDetails}>
                  {meal.entries.length
                    ? meal.entries.map((entry) => entry.foodName).join(', ')
                    : 'Sin alimentos registrados'}
                </Text>
              </View>
              <Text style={styles.calories}>
                {calories === null ? '—' : Math.round(calories)}
                <Text style={styles.unit}> kcal</Text>
              </Text>
            </View>
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
});
