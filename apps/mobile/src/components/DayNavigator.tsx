import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { colors, radius, spacing, typography } from '@/theme';

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
  const today = toLocalDate(new Date());
  const isToday = date === today;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="Día anterior"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onPrevious}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.primary} name="chevron-back" size={24} />
        </Pressable>

        <View style={styles.dateInfo}>
          <Text style={styles.dateText}>{formatLocalDate(date)}</Text>
          {isToday ? <Text style={styles.todayBadge}>Hoy</Text> : null}
        </View>

        <Pressable
          accessibilityLabel="Día siguiente"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onNext}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.primary} name="chevron-forward" size={24} />
        </Pressable>
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

const styles = StyleSheet.create({
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
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
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
