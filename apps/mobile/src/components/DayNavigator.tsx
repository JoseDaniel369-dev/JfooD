import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '@/features/motion/FadeInView';
import { usePressScale } from '@/features/motion/usePressScale';
import { formatLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { hapticSelection } from '@/features/haptics/haptics';
import { fonts, radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface DayNavigatorProps {
  date: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DayNavigator({
  date,
  onPrevious,
  onNext,
  onToday,
}: DayNavigatorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const prevScale = usePressScale(0.92);
  const nextScale = usePressScale(0.92);
  const today = toLocalDate(new Date());
  const isToday = date === today;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <AnimatedIconButton
          accessibilityLabel="Día anterior"
          accessibilityRole="button"
          hitSlop={8}
          iconColor={colors.primary}
          iconName="chevron-back"
          onPress={() => {
            hapticSelection();
            onPrevious();
          }}
          scaleProps={prevScale}
          style={styles.navButton}
        />

        <FadeInView key={date} style={styles.dateInfo} translateY={4}>
          <Text style={styles.dateText}>{formatLocalDate(date)}</Text>
          {isToday ? <Text style={styles.todayBadge}>Hoy</Text> : null}
        </FadeInView>

        <AnimatedIconButton
          accessibilityLabel="Día siguiente"
          accessibilityRole="button"
          hitSlop={8}
          iconColor={colors.primary}
          iconName="chevron-forward"
          onPress={() => {
            hapticSelection();
            onNext();
          }}
          scaleProps={nextScale}
          style={styles.navButton}
        />
      </View>

      {!isToday ? (
        <Pressable
          accessibilityLabel="Volver a hoy"
          accessibilityRole="button"
          onPress={onToday}
          style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
        >
          <Text style={styles.todayButtonText}>Volver a hoy</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface AnimatedIconButtonProps {
  accessibilityLabel: string;
  accessibilityRole: 'button';
  hitSlop?: number;
  iconColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  scaleProps: ReturnType<typeof usePressScale>;
  style: object;
}

function AnimatedIconButton({
  iconColor,
  iconName,
  onPress,
  scaleProps,
  style,
  ...props
}: AnimatedIconButtonProps) {
  const { scale, onPressIn, onPressOut } = scaleProps;
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style}
      >
        <Ionicons color={iconColor} name={iconName} size={24} />
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    navButton: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    dateInfo: {
      alignItems: 'center',
      flex: 1,
      gap: spacing.xs,
    },
    dateText: {
      fontFamily: fonts.heading,
      color: colors.text,
      fontSize: 16,
      textAlign: 'center',
    },
    todayBadge: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      color: colors.textOnPrimary,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    todayButton: {
      alignItems: 'center',
      alignSelf: 'center',
      padding: spacing.sm,
    },
    todayButtonText: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
