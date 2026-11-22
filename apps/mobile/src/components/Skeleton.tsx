import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing, useTheme } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A grey block that pulses while content loads. */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { backgroundColor: colors.surfaceMuted, borderRadius, height, width },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Placeholder with the shape of a dashboard screen (hero + a few cards). */
export function ScreenSkeleton() {
  const { colors } = useTheme();

  return (
    <View
      accessibilityLabel="Cargando"
      accessibilityLiveRegion="polite"
      style={styles.screen}
    >
      <Skeleton borderRadius={radius.lg} height={188} />
      <View style={styles.row}>
        <Skeleton borderRadius={radius.md} height={64} style={styles.half} />
        <Skeleton borderRadius={radius.md} height={64} style={styles.half} />
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Skeleton height={18} width="40%" />
        <Skeleton height={14} />
        <Skeleton height={14} width="80%" />
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Skeleton height={18} width="55%" />
        <Skeleton height={14} />
        <Skeleton height={14} width="65%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
});
