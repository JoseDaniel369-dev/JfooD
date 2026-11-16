import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { durations, easings } from '@/features/motion/motion';
import { radius, useTheme, type ThemeColors } from '@/theme';

interface ProgressBarProps {
  value: number | null;
  maximum: number;
  color?: string;
  trackColor?: string;
}

export function ProgressBar({
  value,
  maximum,
  color,
  trackColor,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const progress =
    value === null || maximum <= 0
      ? 0
      : Math.min(Math.max(value / maximum, 0), 1);

  const [progressAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progressAnim, {
      toValue: progress,
      duration: durations.slow,
      useNativeDriver: false,
      easing: (x) => easings.easeOutCubic(x),
    });
    animation.start();
    return () => animation.stop();
  }, [progressAnim, progress]);

  const width = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: maximum, now: value ?? 0 }}
      style={[
        styles.track,
        { backgroundColor: trackColor ?? colors.surfaceMuted },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color ?? colors.primary,
            width,
          },
        ]}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    track: {
      borderRadius: radius.pill,
      height: 7,
      overflow: 'hidden',
    },
    fill: {
      borderRadius: radius.pill,
      height: '100%',
    },
  });
}
