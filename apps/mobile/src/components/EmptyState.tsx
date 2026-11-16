import { Ionicons } from '@expo/vector-icons';
import { useMemo, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '@/features/motion/FadeInView';
import { durations, easings } from '@/features/motion/motion';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

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
  const [scale] = useState(() => new Animated.Value(0.8));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 120,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: durations.normal,
        useNativeDriver: true,
        easing: (x) => easings.easeOutCubic(x),
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  return (
    <FadeInView style={styles.container} translateY={12}>
      <Animated.View style={[styles.iconRing, { opacity, transform: [{ scale }] }]}>
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
    </FadeInView>
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
      fontWeight: '700',
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
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
