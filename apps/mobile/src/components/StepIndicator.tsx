import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { durations, easings } from '@/features/motion/motion';
import { radius, spacing, useTheme, type ThemeColors } from '@/theme';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

interface StepIndicatorProps {
  steps: number;
  current: number;
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: steps }).map((_, index) => (
        <StepDot
          key={index}
          active={index <= current}
          colors={colors}
          isLast={index === steps - 1}
        />
      ))}
    </View>
  );
}

function StepDot({
  active,
  colors,
  isLast,
}: {
  active: boolean;
  colors: ThemeColors;
  isLast: boolean;
}) {
  const [width] = useState(() => new Animated.Value(active ? 24 : 8));

  useEffect(() => {
    const animation = Animated.timing(width, {
      toValue: active ? 24 : 8,
      duration: durations.normal,
      useNativeDriver: false,
      easing: (x) => easings.easeOutCubic(x),
    });
    animation.start();
    return () => animation.stop();
  }, [active, width]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: active ? colors.primary : colors.border,
          borderRadius: radius.pill,
          height: 8,
          marginRight: isLast ? 0 : spacing.sm,
          width,
        },
      ]}
    />
  );
}


