import { useCallback, useMemo, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

import { durations, springConfigs } from './motion';

interface UseSwipeDaysOptions {
  onPrev: () => void;
  onNext: () => void;
  threshold?: number;
}

export function useSwipeDays({ onPrev, onNext, threshold = 80 }: UseSwipeDaysOptions) {
  const [translateX] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  const reset = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      ...springConfigs.gentle,
    }).start();
    Animated.spring(opacity, {
      toValue: 1,
      useNativeDriver: true,
      ...springConfigs.gentle,
    }).start();
  }, [translateX, opacity]);

  const trigger = useCallback(
    (direction: 'prev' | 'next') => {
      const target = direction === 'next' ? -200 : 200;
      Animated.timing(translateX, {
        toValue: target,
        duration: durations.fast,
        useNativeDriver: true,
      }).start(() => {
        if (direction === 'next') {
          onNext();
        } else {
          onPrev();
        }
        translateX.setValue(direction === 'next' ? 200 : -200);
        opacity.setValue(0);
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: durations.normal,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: durations.normal,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [translateX, opacity, onPrev, onNext],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const horizontal = Math.abs(gestureState.dx) > 12;
          const dominant = Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
          return horizontal && dominant;
        },
        onPanResponderMove: (_evt, gestureState) => {
          translateX.setValue(gestureState.dx);
          opacity.setValue(1 - Math.min(Math.abs(gestureState.dx) / 200, 0.25));
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx > threshold) {
            trigger('prev');
          } else if (gestureState.dx < -threshold) {
            trigger('next');
          } else {
            reset();
          }
        },
        onPanResponderTerminate: reset,
      }),
    [translateX, opacity, threshold, reset, trigger],
  );

  return { translateX, opacity, panHandlers: panResponder.panHandlers };
}
