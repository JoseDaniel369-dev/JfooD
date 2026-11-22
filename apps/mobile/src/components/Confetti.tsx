import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { buildConfettiPieces, type ConfettiPiece } from '@/features/motion/confettiPieces';
import { useTheme } from '@/theme';

interface ConfettiProps {
  /** Change this number to fire a new shower (0 = none yet). */
  burst: number;
  count?: number;
}

/**
 * A shower of confetti over the whole screen. It ignores touches and, with the
 * system "remove animations" setting on, jumps straight to the end (nothing
 * visible).
 */
export function Confetti({ burst, count = 32 }: ConfettiProps) {
  const { colors } = useTheme();
  const { height, width } = useWindowDimensions();

  const palette = useMemo(
    () => [colors.primaryBright, colors.accent, colors.celebrate, colors.protein, colors.fat],
    [colors],
  );
  const pieces = useMemo(
    () => buildConfettiPieces(count, palette.length, burst + 1),
    [burst, count, palette.length],
  );

  if (burst <= 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <Piece
          key={`${burst}-${index}`}
          color={palette[piece.color] ?? colors.accent}
          height={height}
          piece={piece}
          width={width}
        />
      ))}
    </View>
  );
}

function Piece({
  piece,
  color,
  width,
  height,
}: {
  piece: ConfettiPiece;
  color: string;
  width: number;
  height: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        piece.delay,
        withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [piece.delay, piece.duration, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: piece.drift * progress.value },
      { translateY: interpolate(progress.value, [0, 1], [-30, height * 0.85]) },
      { rotate: `${piece.spin * progress.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: color,
          borderRadius: piece.round ? piece.size : 2,
          height: piece.round ? piece.size : piece.size * 1.6,
          left: piece.x * width,
          width: piece.size,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
});
