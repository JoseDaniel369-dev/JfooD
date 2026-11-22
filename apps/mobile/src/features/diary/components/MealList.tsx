import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { SwipeableRow } from '@/components/SwipeableRow';
import { entryNutrients, formatPartialAmount } from '@/features/diary/utils/totals';
import { foodEmoji } from '@/features/foods/utils/foodEmoji';
import { hapticSelection } from '@/features/haptics/haptics';
import { rowLayout } from '@/features/motion/springs';
import {
  radius,
  shadows,
  spacing,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';
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
  /** Swipe an entry to the left to delete it (offer "Deshacer"). */
  onEntryDelete?: (entry: DiaryEntry) => void;
  /** Swipe an entry to the right to duplicate it. */
  onEntryDuplicate?: (entry: DiaryEntry) => void;
  onMealPress?: (mealType: MealType) => void;
}

const MEAL_EMOJIS: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  snack: '🍎',
  dinner: '🍝',
};

export function MealList({
  meals,
  variant = 'summary',
  onAddFood,
  onEntryPress,
  onEntryDelete,
  onEntryDuplicate,
  onMealPress,
}: MealListProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.list}>
      {MEALS.map(({ type, label }, index) => {
        const meal = meals[type];
        const isDetailed = variant === 'detailed';
        const isPressable = variant === 'summary' && Boolean(onMealPress);

        const headerContent = (
          <>
            <View style={styles.iconContainer}>
              <Text style={styles.mealEmoji}>{MEAL_EMOJIS[type]}</Text>
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
                {formatPartialAmount(meal.partial.caloriesKcal)}
                <Text style={styles.unit}> kcal</Text>
              </Text>
              {isDetailed && onAddFood ? (
                <Pressable
                  accessibilityLabel={`Añadir alimento a ${label}`}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => {
                    hapticSelection();
                    onAddFood(type);
                  }}
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    color={colors.textOnPrimary}
                    name="add"
                    size={22}
                  />
                </Pressable>
              ) : null}
            </View>
          </>
        );

        return (
          <View key={type}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {isPressable ? (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="button"
                onPress={() => onMealPress?.(type)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.pressed,
                ]}
              >
                {headerContent}
              </Pressable>
            ) : (
              <View
                accessibilityLabel={label}
                accessibilityRole="header"
                style={styles.row}
              >
                {headerContent}
              </View>
            )}

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
                  meal.entries.map((entry) => {
                    const eaten = entryNutrients(entry.per100g, entry.grams);

                    return (
                    <Animated.View
                      key={entry.id}
                      entering={FadeIn}
                      exiting={FadeOut}
                      layout={rowLayout}
                    >
                    <SwipeableRow
                      onDelete={onEntryDelete ? () => onEntryDelete(entry) : undefined}
                      onDuplicate={onEntryDuplicate ? () => onEntryDuplicate(entry) : undefined}
                    >
                    <Pressable
                      accessibilityLabel={`${entry.foodName}, ${entry.grams} gramos`}
                      accessibilityRole="button"
                      onPress={() => onEntryPress?.(entry)}
                      style={({ pressed }) => [
                        styles.entry,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.entryEmoji}>
                        <Text style={styles.entryEmojiText}>{foodEmoji(entry.foodName)}</Text>
                      </View>
                      <View style={styles.entryMain}>
                        <Text style={styles.entryName}>{entry.foodName}</Text>
                        <Text style={styles.entryGrams}>{entry.grams} g</Text>
                        <View style={styles.entryMacros}>
                          <MacroBadge
                            color={colors.protein}
                            label="P"
                            amount={eaten.proteinGrams}
                          />
                          <MacroBadge
                            color={colors.carbohydrates}
                            label="C"
                            amount={eaten.carbohydrateGrams}
                          />
                          <MacroBadge
                            color={colors.fat}
                            label="G"
                            amount={eaten.fatGrams}
                          />
                        </View>
                      </View>
                      <Text style={styles.entryCalories}>
                        {eaten.caloriesKcal === null
                          ? '—'
                          : Math.round(eaten.caloriesKcal)}
                        <Text style={styles.unit}> kcal</Text>
                      </Text>
                    </Pressable>
                    </SwipeableRow>
                    </Animated.View>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function MacroBadge({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number | null;
  color: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (amount === null) return null;

  return (
    <View style={styles.macroBadge}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroBadgeText}>
        {label} {Math.round(amount)}g
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    mealEmoji: {
      fontSize: 22,
    },
    entryEmoji: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    entryEmojiText: {
      fontSize: 20,
    },
    mealCopy: {
      flex: 1,
      gap: 3,
    },
    mealName: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    mealDetails: {
      ...typography.caption,
      color: colors.textMuted,
    },
    mealActions: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    calories: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    unit: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: '400',
    },
    addButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
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
      ...shadows.sm,
    },
    entryMain: {
      flex: 1,
      gap: 2,
    },
    entryName: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    entryGrams: {
      ...typography.caption,
      color: colors.textMuted,
    },
    entryMacros: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    macroBadge: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    macroDot: {
      borderRadius: radius.pill,
      height: 6,
      width: 6,
    },
    macroBadgeText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    entryCalories: {
      ...typography.body,
      color: colors.text,
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
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
