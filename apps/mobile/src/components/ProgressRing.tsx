import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { durations, easings } from '@/features/motion/motion';
import { useTheme } from '@/theme';

interface ProgressRingProps extends PropsWithChildren {
  /** Amount reached. Values above `maximum` fill the ring completely. */
  value: number;
  maximum: number;
  size?: number;
  strokeWidth?: number;
  /** Colour of the progress arc. Defaults to the accent colour. */
  color?: string;
  /** Colour of the empty ring. Defaults to a translucent white (for hero cards). */
  trackColor?: string;
  accessibilityLabel: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular progress indicator with room for content in the centre. */
export function ProgressRing({
  value,
  maximum,
  size = 84,
  strokeWidth = 8,
  color,
  trackColor = 'rgba(255,255,255,0.18)',
  accessibilityLabel,
  children,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = maximum <= 0 ? 0 : Math.min(Math.max(value / maximum, 0), 1);

  const [offset] = useState(() => new Animated.Value(circumference));

  useEffect(() => {
    const animation = Animated.timing(offset, {
      toValue: circumference * (1 - progress),
      duration: durations.slower,
      useNativeDriver: false,
      easing: (x) => easings.easeOutCubic(x),
    });
    animation.start();
    return () => animation.stop();
  }, [offset, progress, circumference]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{ height: size, width: size }}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation={-90}
          stroke={color ?? colors.accent}
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
