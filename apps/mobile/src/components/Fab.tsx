import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { hapticSuccess } from '@/features/haptics/haptics';
import { usePressScale } from '@/features/motion/usePressScale';
import { radius, spacing, useTheme, type ThemeColors } from '@/theme';

interface FabProps {
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  onPress: () => void;
}

export function Fab({
  icon = 'add',
  accessibilityLabel = 'Añadir',
  onPress,
}: FabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { scale, onPressIn, onPressOut } = usePressScale(0.9);

  return (
    <Animated.View
      style={[
        styles.fab,
        {
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => {
          hapticSuccess();
          onPress();
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.pressable}
      >
        <Ionicons color={colors.textOnPrimary} name={icon} size={28} />
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    fab: {
      borderRadius: radius.pill,
      bottom: spacing.xxl,
      elevation: 6,
      height: 60,
      position: 'absolute',
      right: spacing.xl,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      width: 60,
    },
    pressable: {
      alignItems: 'center',
      borderRadius: radius.pill,
      height: 60,
      justifyContent: 'center',
      width: 60,
    },
  });
}
