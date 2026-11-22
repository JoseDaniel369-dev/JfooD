import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { addDays, startOfWeek, toLocalDate } from '@/features/diary/utils/date';
import {
  buildWeekStrip,
  formatWeekRange,
  type WeekStripDay,
  type WeekStripDayData,
} from '@/features/diary/utils/weekStrip';
import { radius, spacing, tabularNumbers, typography, useTheme, type ThemeColors } from '@/theme';

interface WeekStripProps {
  selectedDate: string;
  goalKcal: number;
  /** What is known of each day of the week, keyed by date. */
  data: Readonly<Record<string, WeekStripDayData | undefined>>;
  onSelect: (date: string) => void;
  /** Show the arrows and the "Hoy" shortcut (default true). */
  showHeader?: boolean;
}

const CELL = 40;
const RING_STROKE = 3;

/** Monday-to-Sunday strip: tap a day to go there; each day shows how full it was. */
export function WeekStrip({
  selectedDate,
  goalKcal,
  data,
  onSelect,
  showHeader = true,
}: WeekStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = toLocalDate(new Date());
  const days = useMemo(
    () => buildWeekStrip(selectedDate, today, goalKcal, data),
    [selectedDate, today, goalKcal, data],
  );
  const monday = startOfWeek(selectedDate);
  const isCurrentWeek = monday === startOfWeek(today);

  return (
    <View style={styles.container}>
      {showHeader ? (
        <View style={styles.header}>
          <AnimatedPressable
            accessibilityLabel="Semana anterior"
            accessibilityRole="button"
            haptic
            hitSlop={8}
            onPress={() => onSelect(addDays(selectedDate, -7))}
            style={styles.arrow}
          >
            <Ionicons color={colors.text} name="chevron-back" size={20} />
          </AnimatedPressable>

          <Text style={styles.range}>{formatWeekRange(monday)}</Text>

          <View style={styles.headerEnd}>
            {!isCurrentWeek ? (
              <AnimatedPressable
                accessibilityLabel="Ir a hoy"
                accessibilityRole="button"
                haptic
                onPress={() => onSelect(today)}
                style={styles.todayButton}
              >
                <Text style={styles.todayText}>Hoy</Text>
              </AnimatedPressable>
            ) : null}
            <AnimatedPressable
              accessibilityLabel="Semana siguiente"
              accessibilityRole="button"
              haptic
              hitSlop={8}
              onPress={() => onSelect(addDays(selectedDate, 7))}
              style={styles.arrow}
            >
              <Ionicons color={colors.text} name="chevron-forward" size={20} />
            </AnimatedPressable>
          </View>
        </View>
      ) : null}

      <View style={styles.row}>
        {days.map((day) => (
          <DayCell key={day.date} day={day} onPress={() => onSelect(day.date)} />
        ))}
      </View>
    </View>
  );
}

function DayCell({ day, onPress }: { day: WeekStripDay; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const radiusPx = (CELL - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const reachedGoal = day.progress >= 0.9;

  return (
    <AnimatedPressable
      accessibilityLabel={`${day.dayNumber}${day.isToday ? ', hoy' : ''}${
        day.logged ? ', con registros' : ''
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected: day.isSelected }}
      haptic
      onPress={onPress}
      style={styles.cell}
    >
      <Text style={[styles.weekday, day.isSelected && styles.weekdaySelected]}>{day.weekday}</Text>

      <View style={[styles.circle, day.isSelected && styles.circleSelected, day.isToday && !day.isSelected && styles.circleToday]}>
        {day.progress > 0 && !day.isSelected ? (
          <Svg height={CELL} style={StyleSheet.absoluteFill} width={CELL}>
            <Circle
              cx={CELL / 2}
              cy={CELL / 2}
              fill="none"
              origin={`${CELL / 2}, ${CELL / 2}`}
              r={radiusPx}
              rotation={-90}
              stroke={reachedGoal ? colors.success : colors.accent}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - day.progress)}
              strokeLinecap="round"
              strokeWidth={RING_STROKE}
            />
          </Svg>
        ) : null}
        <Text
          style={[
            styles.dayNumber,
            day.isSelected && styles.dayNumberSelected,
            day.isFuture && !day.isSelected && styles.dayNumberFuture,
          ]}
        >
          {day.dayNumber}
        </Text>
      </View>

      <View style={[styles.dot, day.logged && (day.isSelected ? styles.dotSelected : styles.dotLogged)]} />
    </AnimatedPressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerEnd: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    arrow: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    range: {
      ...typography.title,
      color: colors.text,
      fontSize: 16,
    },
    todayButton: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    todayText: {
      ...typography.caption,
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cell: {
      alignItems: 'center',
      gap: spacing.xs,
      minWidth: 44,
    },
    weekday: {
      ...typography.label,
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    weekdaySelected: {
      color: colors.primary,
    },
    circle: {
      alignItems: 'center',
      borderRadius: radius.pill,
      height: CELL,
      justifyContent: 'center',
      width: CELL,
    },
    circleSelected: {
      backgroundColor: colors.primary,
    },
    circleToday: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    dayNumber: {
      ...typography.title,
      ...tabularNumbers,
      color: colors.text,
      fontSize: 15,
    },
    dayNumberSelected: {
      color: colors.textOnPrimary,
    },
    dayNumberFuture: {
      color: colors.textMuted,
    },
    dot: {
      borderRadius: radius.pill,
      height: 5,
      width: 5,
    },
    dotLogged: {
      backgroundColor: colors.primaryBright,
    },
    dotSelected: {
      backgroundColor: colors.primary,
    },
  });
}
