import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { hapticImpact } from '@/features/haptics/haptics';
import { usePressScale } from '@/features/motion/usePressScale';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
type ButtonSize = 'default' | 'small';

interface ButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { scale, onPressIn, onPressOut } = usePressScale();

  const isBlock = variant === 'primary' || variant === 'accent' || variant === 'danger';
  const iconColor =
    variant === 'accent'
      ? colors.onAccent
      : variant === 'danger'
        ? colors.onDanger
        : isBlock
          ? colors.textOnPrimary
          : colors.primary;

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        disabled={disabled || loading}
        onPress={() => {
          hapticImpact();
          onPress();
        }}
        onPressIn={disabled || loading ? undefined : onPressIn}
        onPressOut={disabled || loading ? undefined : onPressOut}
        style={({ pressed }) => [
          styles.base,
          size === 'small' && styles.small,
          styles[variant],
          (disabled || loading) && styles.disabled,
          pressed && !disabled && !loading && styles.pressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isBlock ? colors.textOnPrimary : colors.primary} />
        ) : (
          <View style={styles.content}>
            {icon ? (
              <Ionicons color={iconColor} name={icon} size={18} />
            ) : null}
            <Text style={[styles.text, styles[`${variant}Text` as const]]}>
              {title}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    animatedContainer: {
      alignSelf: 'stretch',
    },
    base: {
      alignItems: 'center',
      borderRadius: radius.md,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    small: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    content: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    text: {
      ...typography.body,
      fontWeight: '700',
    },
    primary: {
      backgroundColor: colors.primary,
    },
    primaryText: {
      color: colors.textOnPrimary,
    },
    accent: {
      backgroundColor: colors.accent,
    },
    accentText: {
      color: colors.onAccent,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    secondaryText: {
      color: colors.text,
    },
    danger: {
      backgroundColor: colors.danger,
    },
    dangerText: {
      color: colors.onDanger,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    ghostText: {
      color: colors.primary,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.9,
    },
  });
}
