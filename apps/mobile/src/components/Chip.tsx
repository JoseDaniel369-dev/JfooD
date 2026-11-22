import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { radius, spacing, typography, useTheme, type ThemeColors, fontSizes, fonts } from '@/theme';

interface ChipProps {
  label: string;
  /** Emoji shown before the label. */
  emoji?: string;
  /** Icon shown before the label (for actions and metrics; emojis are for food). */
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** A rounded tag that can be selected: filters, quick foods, amounts. */
export function Chip({
  label,
  emoji,
  icon,
  selected = false,
  onPress,
  accessibilityLabel,
}: ChipProps) {
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
      {icon ? (
        <Ionicons color={selected ? colors.textOnPrimary : colors.primary} name={icon} size={18} />
      ) : null}
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text maxFontSizeMultiplier={1.3} style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
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
      fontSize: fontSizes.bodyLarge,
      fontFamily: fonts.regular,
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
