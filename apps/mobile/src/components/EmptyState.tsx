import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { fadeUp } from '@/features/motion/springs';
import { radius, spacing, typography, useTheme, type ThemeColors, fonts } from '@/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View entering={fadeUp()} style={styles.container}>
      <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.iconRing}>
        <View style={styles.iconCircle}>
          <Ionicons color={colors.primary} name={icon} size={28} />
        </View>
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
    },
    iconRing: {
      alignItems: 'center',
      borderColor: colors.primaryLight,
      borderRadius: radius.pill,
      borderWidth: 2,
      justifyContent: 'center',
      marginBottom: spacing.xs,
      padding: spacing.sm,
    },
    iconCircle: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.pill,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    title: {
      ...typography.body,
      color: colors.text,
      fontFamily: fonts.heading,
    },
    message: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
      textAlign: 'center',
    },
    action: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    actionText: {
      ...typography.caption,
      color: colors.primary,
      fontFamily: fonts.heading,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
