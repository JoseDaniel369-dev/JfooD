import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { durations, easings } from '@/features/motion/motion';
import { useTheme } from '@/theme';

interface StreakRingProps extends PropsWithChildren {
  /** Value displayed (e.g. current streak days). */
  value: number;
  /** Maximum used for the ring progress (e.g. 7 or best streak). */
  maximum: number;
  size?: number;
  strokeWidth?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function StreakRing({
  value,
  maximum,
  size = 84,
  strokeWidth = 8,
  children,
}: StreakRingProps) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = maximum <= 0 ? 0 : Math.min(Math.max(value / maximum, 0), 1);

  const [offset] = useState(() => new Animated.Value(circumference));

  useEffect(() => {
    const target = circumference * (1 - progress);
    const animation = Animated.timing(offset, {
      toValue: target,
      duration: durations.slower,
      useNativeDriver: false,
      easing: (x) => easings.easeOutCubic(x),
    });
    animation.start();
    return () => animation.stop();
  }, [offset, progress, circumference]);

  return (
    <View
      accessibilityLabel={`Racha de ${value} de ${maximum} días`}
      accessibilityRole="image"
      style={{ height: size, width: size }}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation={-90}
          stroke={colors.accent}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
