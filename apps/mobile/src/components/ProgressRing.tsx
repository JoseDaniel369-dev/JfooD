import type { PropsWithChildren } from 'react';
import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { onHeroTrack, useTheme } from '@/theme';

interface ProgressRingProps extends PropsWithChildren {
  /** Amount reached. Values above `maximum` fill the ring completely. */
  value: number;
  maximum: number;
  size?: number;
  strokeWidth?: number;
  /** Solid colour of the progress arc. Defaults to the accent colour. */
  color?: string;
  /** Two colours for a gradient arc (wins over `color`). */
  gradient?: readonly [string, string];
  /** Colour of the empty ring. Defaults to a translucent white (for hero cards). */
  trackColor?: string;
  accessibilityLabel: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Fraction of the ring that is filled, between 0 and 1. */
export function ringProgress(value: number, maximum: number): number {
  if (!(maximum > 0) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value / maximum, 0), 1);
}

/** Circular progress indicator with room for content in the centre. */
export function ProgressRing({
  value,
  maximum,
  size = 84,
  strokeWidth = 8,
  color,
  gradient,
  trackColor = onHeroTrack,
  accessibilityLabel,
  children,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = ringProgress(value, maximum);
  // useId returns ids with colons, which are not valid inside url(#…).
  const gradientId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const filled = useSharedValue(0);

  useEffect(() => {
    filled.set(
      withTiming(progress, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [filled, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - filled.value),
  }));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{ height: size, width: size }}
    >
      <Svg height={size} width={size}>
        {gradient ? (
          <Defs>
            <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor={gradient[0]} />
              <Stop offset="1" stopColor={gradient[1]} />
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation={-90}
          stroke={gradient ? `url(#${gradientId})` : (color ?? colors.accent)}
          strokeDasharray={circumference}
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
