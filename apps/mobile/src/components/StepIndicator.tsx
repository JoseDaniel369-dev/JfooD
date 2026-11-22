import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springs } from '@/features/motion/springs';
import { radius, spacing, useTheme, type ThemeColors } from '@/theme';

const DOT = 8;
const ACTIVE_WIDTH = 28;

interface StepIndicatorProps {
  steps: number;
  /** Zero-based index of the current step. */
  current: number;
}

/** Progress dots: the current step stretches into a pill. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityLabel={`Paso ${current + 1} de ${steps}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: steps, now: current + 1 }}
      style={styles.row}
    >
      {Array.from({ length: steps }, (_, index) => (
        <StepDot key={index} colors={colors} current={index === current} done={index < current} />
      ))}
    </View>
  );
}

function StepDot({ colors, current, done }: { colors: ThemeColors; current: boolean; done: boolean }) {
  const width = useSharedValue(current ? ACTIVE_WIDTH : DOT);

  useEffect(() => {
    width.set(withSpring(current ? ACTIVE_WIDTH : DOT, springs.soft));
  }, [current, width]);

  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: current || done ? colors.primary : colors.border },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  dot: {
    borderRadius: radius.pill,
    height: DOT,
  },
});
