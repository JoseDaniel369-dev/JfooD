import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ringProgress } from '@/components/ProgressRing';
import { springs } from '@/features/motion/springs';
import { radius, spacing, tabularNumbers, typography, useTheme, type ThemeColors } from '@/theme';

interface MacroPillProps {
  label: string;
  /** Known amount so far. */
  value: number;
  /** Daily goal in the same unit; 0 or less hides the bar. */
  goal: number;
  unit?: string;
  /** Colour of the fill. */
  color: string;
  /** Soft background of the pill. */
  tint: string;
  /** True when some foods had no data: the value is a minimum ("≥"). */
  approximate?: boolean;
}

/** A macro as a rounded, tinted bar: "Proteínas 42 / 110 g". */
export function MacroPill({
  label,
  value,
  goal,
  unit = 'g',
  color,
  tint,
  approximate = false,
}: MacroPillProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fraction = ringProgress(value, goal);

  const filled = useSharedValue(0);
  useEffect(() => {
    filled.set(withSpring(fraction, springs.soft));
  }, [filled, fraction]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${filled.value * 100}%`,
  }));

  const amount = `${approximate ? '≥ ' : ''}${Math.round(value)}`;

  return (
    <View
      accessibilityLabel={`${label}: ${amount} de ${Math.round(goal)} ${unit}`}
      style={[styles.pill, { backgroundColor: tint }]}
    >
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {amount}
          <Text style={styles.goal}> / {Math.round(goal)} {unit}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pill: {
      borderRadius: radius.md,
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    row: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    label: {
      ...typography.caption,
      color: colors.text,
    },
    value: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
      fontSize: 16,
    },
    goal: {
      ...typography.caption,
      color: colors.textMuted,
    },
    track: {
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      height: 8,
      overflow: 'hidden',
    },
    fill: {
      borderRadius: radius.pill,
      height: '100%',
    },
  });
}
