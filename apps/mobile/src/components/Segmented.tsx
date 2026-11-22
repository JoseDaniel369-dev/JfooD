import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { springs } from '@/features/motion/springs';
import { radius, shadows, spacing, typography, useTheme, type ThemeColors } from '@/theme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Tabs inside a screen: the highlight slides to the chosen option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = width > 0 ? (width - INSET * 2) / options.length : 0;

  const offset = useSharedValue(0);
  useEffect(() => {
    offset.set(withSpring(index * segmentWidth, springs.soft));
  }, [index, offset, segmentWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: segmentWidth }, indicatorStyle]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <AnimatedPressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            haptic
            onPress={() => onChange(option.value)}
            scaleTo={0.97}
            style={styles.segment}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={[styles.label, selected && styles.labelSelected]}
            >
              {option.label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const INSET = 4;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      flexDirection: 'row',
      padding: INSET,
    },
    indicator: {
      // A raised colour (not only a shadow): shadows are invisible in dark mode.
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.pill,
      bottom: INSET,
      left: INSET,
      position: 'absolute',
      top: INSET,
      ...shadows.sm,
    },
    segment: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.sm,
    },
    label: {
      ...typography.caption,
      color: colors.textMuted,
    },
    labelSelected: {
      color: colors.text,
      fontFamily: typography.title.fontFamily,
    },
  });
}
