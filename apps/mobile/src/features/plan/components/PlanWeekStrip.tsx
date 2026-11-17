import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getPlanWeek,
  type PlanDaySummary,
} from '@/data/sqlite/repositories/planRepository';
import { startOfWeek, toLocalDate } from '@/features/diary/utils/date';
import { hapticSelection } from '@/features/haptics/haptics';
import { fonts, radius, spacing, tabularNumbers, useTheme, type ThemeColors } from '@/theme';

const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

interface PlanWeekStripProps {
  selectedDate: string;
  onSelect: (localDate: string) => void;
  /** Changes whenever the plan is edited so the totals are reloaded. */
  version: string;
}

/** Seven tappable days of the selected week with their planned calories. */
export function PlanWeekStrip({ selectedDate, onSelect, version }: PlanWeekStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const [week, setWeek] = useState<PlanDaySummary[]>([]);
  const weekStart = startOfWeek(selectedDate);
  const today = toLocalDate(new Date());

  useEffect(() => {
    let cancelled = false;
    void getPlanWeek(database, weekStart)
      .then((summary) => {
        if (!cancelled) setWeek(summary);
      })
      .catch(() => {
        if (!cancelled) setWeek([]);
      });
    return () => {
      cancelled = true;
    };
  }, [database, weekStart, version]);

  return (
    <View accessibilityLabel="Semana del plan" style={styles.row}>
      {week.map((day, index) => {
        const selected = day.localDate === selectedDate;
        const kcal =
          day.entryCount === 0
            ? '·'
            : day.caloriesKcal === null
              ? '—'
              : `${day.partial ? '≥' : ''}${Math.round(day.caloriesKcal)}`;

        return (
          <Pressable
            key={day.localDate}
            accessibilityLabel={`${WEEKDAY_LETTERS[index]} ${day.localDate.slice(8)}: ${
              day.entryCount === 0 ? 'sin planificar' : `${kcal} kcal`
            }`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              hapticSelection();
              onSelect(day.localDate);
            }}
            style={[styles.day, selected && styles.daySelected]}
          >
            <Text style={[styles.letter, selected && styles.textSelected]}>
              {WEEKDAY_LETTERS[index]}
            </Text>
            <Text
              style={[
                styles.number,
                day.localDate === today && styles.today,
                selected && styles.textSelected,
              ]}
            >
              {Number(day.localDate.slice(8))}
            </Text>
            <Text style={[styles.kcal, selected && styles.textSelected]}>{kcal}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.xs },
    day: {
      alignItems: 'center',
      borderRadius: radius.md,
      flex: 1,
      gap: 2,
      minHeight: 64,
      paddingVertical: spacing.sm,
    },
    daySelected: { backgroundColor: colors.primary },
    letter: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 12 },
    number: { ...tabularNumbers, color: colors.text, fontFamily: fonts.heading, fontSize: 16 },
    today: { color: colors.accent },
    kcal: { ...tabularNumbers, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
    textSelected: { color: colors.textOnPrimary },
  });
}
