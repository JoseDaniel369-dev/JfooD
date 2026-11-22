import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';

import { fadeUp } from '@/features/motion/springs';
import {
  heroGradient,
  radius,
  shadows,
  spacing,
  useTheme,
  type ThemeColors,
} from '@/theme';

type CardVariant = 'default' | 'hero' | 'accent';

interface CardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  animated?: boolean;
  delay?: number;
}

export function Card({
  children,
  style,
  variant = 'default',
  animated = false,
  delay = 0,
}: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (() => {
    if (variant === 'hero') {
      return (
        <LinearGradient
          colors={[...heroGradient]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.card, styles.hero, style]}
        >
          {children}
        </LinearGradient>
      );
    }

    if (variant === 'accent') {
      return (
        <View style={[styles.card, styles.accent, style]}>{children}</View>
      );
    }

    return <View style={[styles.card, style]}>{children}</View>;
  })();

  if (animated) {
    return (
      <Animated.View entering={fadeUp(delay)} style={{ alignSelf: 'stretch' }}>
        {content}
      </Animated.View>
    );
  }

  return content;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.lg,
      padding: spacing.xl,
      ...shadows.sm,
    },
    hero: {
      borderColor: 'transparent',
      borderWidth: 0,
      ...shadows.md,
    },
    accent: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
  });
}
