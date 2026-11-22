import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface ChipProps {
  label: string;
  /** Emoji shown before the label. */
  emoji?: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** A rounded tag that can be selected: filters, quick foods, amounts. */
export function Chip({ label, emoji, selected = false, onPress, accessibilityLabel }: ChipProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      haptic
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </AnimatedPressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    selected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    emoji: {
      fontSize: 16,
    },
    label: {
      ...typography.caption,
      color: colors.text,
    },
    labelSelected: {
      color: colors.textOnPrimary,
    },
  });
}
