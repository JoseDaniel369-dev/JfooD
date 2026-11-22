import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import type { Food } from '@/features/foods/types';
import { foodEmoji } from '@/features/foods/utils/foodEmoji';
import { radius, spacing, tabularNumbers, typography, useTheme, type ThemeColors } from '@/theme';

interface FoodRowProps {
  food: Food;
  onPress: (food: Food) => void;
  onToggleFavorite: (food: Food) => void;
  /** Opens the food's own page (nutrients, portions, edit). */
  onInfo: (food: Food) => void;
}

/** "152 kcal · P 25 · C 0 · G 5" with "—" where a value is unknown. */
export function describeFoodMacros(food: Food): string {
  const part = (value: number | null) => (value === null ? '—' : String(Math.round(value * 10) / 10));
  return `${part(food.caloriesKcal)} kcal · P ${part(food.proteinGrams)} · C ${part(food.carbohydrateGrams)} · G ${part(food.fatGrams)}`;
}

/** One food of a list: emoji, name, macros per 100 g, favourite star. */
export function FoodRow({ food, onPress, onToggleFavorite, onInfo }: FoodRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <AnimatedPressable
        accessibilityLabel={`${food.name}, ${describeFoodMacros(food)} por 100 gramos`}
        accessibilityRole="button"
        onPress={() => onPress(food)}
        scaleTo={0.98}
        style={styles.main}
      >
        <View style={styles.emoji}>
          <Text style={styles.emojiText}>{foodEmoji(food.name)}</Text>
        </View>
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {food.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {food.brand ? `${food.brand} · ` : ''}
            {describeFoodMacros(food)}
          </Text>
        </View>
      </AnimatedPressable>

      <Pressable
        accessibilityLabel={food.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => onToggleFavorite(food)}
        style={styles.iconButton}
      >
        <Ionicons
          color={food.isFavorite ? colors.accent : colors.textMuted}
          name={food.isFavorite ? 'star' : 'star-outline'}
          size={22}
        />
      </Pressable>
      <Pressable
        accessibilityLabel={`Detalles de ${food.name}`}
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => onInfo(food)}
        style={styles.iconButton}
      >
        <Ionicons color={colors.textMuted} name="information-circle-outline" size={22} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingRight: spacing.xs,
    },
    main: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    emoji: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    emojiText: {
      fontSize: 24,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...typography.title,
      color: colors.text,
      fontSize: 16,
    },
    meta: {
      ...typography.caption,
      ...tabularNumbers,
      color: colors.textMuted,
      fontSize: 12,
    },
    iconButton: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      width: 40,
    },
  });
}
