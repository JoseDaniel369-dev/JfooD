import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { durations, easings } from './motion';

export function useCountUp(target: number, duration: number = durations.slower, decimals = 0) {
  const [display, setDisplay] = useState(target);
  const [value] = useState(() => new Animated.Value(target));

  useEffect(() => {
    const listener = value.addListener(({ value: v }) => {
      setDisplay(Number(v.toFixed(decimals)));
    });

    Animated.timing(value, {
      toValue: target,
      duration,
      useNativeDriver: true,
      easing: (x) => easings.easeOutCubic(x),
    }).start();

    return () => {
      value.removeListener(listener);
    };
  }, [target, duration, decimals, value]);

  return display;
}
