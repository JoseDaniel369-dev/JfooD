import { useCallback, useState } from 'react';
import { Animated } from 'react-native';

import { isReducedMotion, springConfigs } from './motion';

export function usePressScale(activeScale = 0.96) {
  const [scale] = useState(() => new Animated.Value(1));

  const onPressIn = useCallback(() => {
    if (isReducedMotion()) return;
    Animated.spring(scale, {
      toValue: activeScale,
      useNativeDriver: true,
      ...springConfigs.button,
    }).start();
  }, [scale, activeScale]);

  const onPressOut = useCallback(() => {
    if (isReducedMotion()) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...springConfigs.button,
    }).start();
  }, [scale]);

  return { scale, onPressIn, onPressOut };
}
