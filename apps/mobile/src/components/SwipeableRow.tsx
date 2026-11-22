import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, type PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Swipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { hapticImpact } from '@/features/haptics/haptics';
import { radius, spacing, typography, useTheme, type ThemeColors, fontSizes } from '@/theme';

interface SwipeableRowProps extends PropsWithChildren {
  /** Swipe the row to the left to delete it. */
  onDelete?: () => void;
  /** Swipe the row to the right to duplicate it. */
  onDuplicate?: () => void;
}

/**
 * A list row with swipe actions. The action runs as soon as the row is swiped
 * open and the row closes itself, so a delete should always offer "Deshacer".
 */
export function SwipeableRow({ onDelete, onDuplicate, children }: SwipeableRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeable = useRef<SwipeableMethods>(null);

  // `direction` is the way the finger moved: right reveals the LEFT actions.
  const handleOpen = (direction: SwipeDirection.LEFT | SwipeDirection.RIGHT) => {
    hapticImpact();
    swipeable.current?.close();
    if (direction === SwipeDirection.LEFT) {
      onDelete?.();
    } else {
      onDuplicate?.();
    }
  };

  return (
    <Swipeable
      ref={swipeable}
      friction={2}
      leftThreshold={64}
      onSwipeableOpen={handleOpen}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        onDuplicate
          ? (progress) => (
              <Action
                icon="copy-outline"
                label="Duplicar"
                progress={progress}
                style={styles.duplicate}
                tone="onPrimary"
              />
            )
          : undefined
      }
      renderRightActions={
        onDelete
          ? (progress) => (
              <Action
                icon="trash-outline"
                label="Eliminar"
                progress={progress}
                style={styles.delete}
                tone="onDanger"
              />
            )
          : undefined
      }
      rightThreshold={64}
    >
      {children}
    </Swipeable>
  );
}

function Action({
  icon,
  label,
  progress,
  style,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  progress: SharedValue<number>;
  style: StyleProp<ViewStyle>;
  /** Which "text on this background" colour the action uses (white fails on the dark-mode colours). */
  tone: 'onPrimary' | 'onDanger';
}) {
  const { colors } = useTheme();
  const foreground = tone === 'onDanger' ? colors.onDanger : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={[styles.action, style]}>
      <Animated.View style={[styles.actionContent, contentStyle]}>
        <Ionicons color={foreground} name={icon} size={22} />
        <Text style={[styles.actionLabel, { color: foreground }]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    action: {
      alignItems: 'center',
      borderRadius: radius.md,
      justifyContent: 'center',
      marginVertical: 2,
      width: 96,
    },
    delete: {
      backgroundColor: colors.danger,
      marginLeft: spacing.sm,
    },
    duplicate: {
      backgroundColor: colors.primary,
      marginRight: spacing.sm,
    },
    actionContent: {
      alignItems: 'center',
      gap: 2,
    },
    actionLabel: {
      ...typography.caption,
      fontSize: fontSizes.small,
    },
  });
}
