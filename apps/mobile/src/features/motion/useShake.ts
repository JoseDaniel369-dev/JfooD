import { useCallback, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { durations } from './motion';

export function useShake() {
  const [translateX] = useState(() => new Animated.Value(0));

  const shake = useCallback(() => {
    const step = durations.fast / 4;
    Animated.sequence([
      Animated.timing(translateX, {
        toValue: -8,
        duration: step,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
      Animated.timing(translateX, {
        toValue: 8,
        duration: step,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
      Animated.timing(translateX, {
        toValue: -6,
        duration: step,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
      Animated.timing(translateX, {
        toValue: 6,
        duration: step,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: step,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
    ]).start();
  }, [translateX]);

  return { translateX, shake };
}
