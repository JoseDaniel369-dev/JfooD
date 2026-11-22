import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ringProgress } from '@/components/ProgressRing';
import { springs } from '@/features/motion/springs';
import { gradients, useTheme } from '@/theme';

interface WaterBottleProps {
  /** Water drunk so far. */
  valueMl: number;
  goalMl: number;
  /** Width in px; the bottle is twice as tall. */
  width?: number;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Inside of the bottle, in the 60 × 120 drawing space. */
const BODY_TOP = 22;
const BODY_BOTTOM = 112;
const BOTTLE_PATH =
  'M22 4 h16 v10 c0 6 14 10 14 24 v70 a8 8 0 0 1 -8 8 h-28 a8 8 0 0 1 -8 -8 v-70 c0 -14 14 -18 14 -24 z';

/** A bottle that fills with water as the day's goal gets closer. */
export function WaterBottle({ valueMl, goalMl, width = 64 }: WaterBottleProps) {
  const { colors } = useTheme();
  const fraction = ringProgress(valueMl, goalMl);
  const id = `bottle${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const level = useSharedValue(0);
  useEffect(() => {
    level.set(withSpring(fraction, springs.soft));
  }, [fraction, level]);

  const waterProps = useAnimatedProps(() => {
    const height = (BODY_BOTTOM - BODY_TOP) * level.value;
    return { height, y: BODY_BOTTOM - height };
  });

  return (
    <View
      accessibilityLabel={`${Math.round(valueMl)} de ${Math.round(goalMl)} mililitros de agua`}
      accessibilityRole="image"
    >
      <Svg height={width * 2} viewBox="0 0 60 120" width={width}>
        <Defs>
          <ClipPath id={`${id}clip`}>
            <Path d={BOTTLE_PATH} />
          </ClipPath>
          <LinearGradient id={`${id}fill`} x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={gradients.water[0]} />
            <Stop offset="1" stopColor={gradients.water[1]} />
          </LinearGradient>
        </Defs>
        <Path d={BOTTLE_PATH} fill={colors.waterLight} />
        <AnimatedRect
          animatedProps={waterProps}
          clipPath={`url(#${id}clip)`}
          fill={`url(#${id}fill)`}
          width={60}
          x={0}
        />
        <Path d={BOTTLE_PATH} fill="none" stroke={colors.water} strokeLinejoin="round" strokeWidth={3} />
        <Rect fill={colors.water} height={6} rx={2} width={20} x={20} y={0} />
      </Svg>
    </View>
  );
}
