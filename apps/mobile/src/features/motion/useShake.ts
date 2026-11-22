import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const STEP_MS = 50;

/** A short side-to-side shake (a form that was refused). Apply `shakeStyle` to an Animated.View. */
export function useShake() {
  const translateX = useSharedValue(0);

  const shake = useCallback(() => {
    translateX.set(
      withSequence(
        withTiming(-8, { duration: STEP_MS }),
        withTiming(8, { duration: STEP_MS }),
        withTiming(-6, { duration: STEP_MS }),
        withTiming(6, { duration: STEP_MS }),
        withTiming(0, { duration: STEP_MS }),
      ),
    );
  }, [translateX]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return { shakeStyle, shake };
}
