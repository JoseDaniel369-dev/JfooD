import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { hapticSelection } from '@/features/haptics/haptics';
import { springs } from '@/features/motion/springs';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (1 = no change). */
  scaleTo?: number;
  /** Light tick on press. */
  haptic?: boolean;
}

/** A Pressable that shrinks with a spring while it is held down. */
export function AnimatedPressable({
  style,
  scaleTo = 0.96,
  haptic = false,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReanimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPress={(event) => {
        if (haptic) {
          hapticSelection();
        }
        onPress?.(event);
      }}
      onPressIn={(event) => {
        if (!disabled) {
          scale.set(withSpring(scaleTo, springs.press));
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, springs.press));
        onPressOut?.(event);
      }}
    />
  );
}
