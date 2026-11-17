import { useEffect, useState, type ReactNode } from 'react';
import { Animated, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { durations, easings, isReducedMotion } from './motion';

interface FadeInViewProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export function FadeInView({
  children,
  delay = 0,
  duration = durations.normal,
  translateY = 12,
  style,
  onLayout,
}: FadeInViewProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translate] = useState(() => new Animated.Value(translateY));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay: isReducedMotion() ? 0 : delay,
        useNativeDriver: true,
        easing: (x) => easings.easeOutCubic(x),
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration,
        delay: isReducedMotion() ? 0 : delay,
        useNativeDriver: true,
        easing: (x) => easings.easeOutCubic(x),
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [opacity, translate, duration, delay]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[{ opacity, transform: [{ translateY: translate }] }, style]}
    >
      {children}
    </Animated.View>
  );
}
