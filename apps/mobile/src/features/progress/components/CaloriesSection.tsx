import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { BarChart } from '@/components/BarChart';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { Skeleton } from '@/components/Skeleton';
import { formatLocalDate } from '@/features/diary/utils/date';
import { useCalorieHistory } from '@/features/progress/hooks/useCalorieHistory';
import { radius, spacing, typography, useTheme, type ThemeColors, fontSizes, fonts } from '@/theme';

/** Calories of the last 30 days against the goal, and the way into the weekly summary. */
export function CaloriesSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const history = useCalorieHistory(30);

  return (
    <>
      <Card>
        <SectionHeader
          caption={
            history.averageKcal !== null
              ? `Media de ${history.averageKcal} kcal en ${history.loggedDays} ${history.loggedDays === 1 ? 'día' : 'días'}`
              : undefined
          }
          title="Calorías · últimos 30 días"
        />

        {history.loading ? (
          <Skeleton borderRadius={radius.md} height={140} />
        ) : history.loggedDays === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            message="Cuando registres comidas, verás aquí tus calorías día a día."
            title="Aún no hay datos"
          />
        ) : (
          <>
            <BarChart
              accessibilityLabel={`Calorías de los últimos 30 días. Objetivo ${Math.round(history.goalKcal)} kilocalorías`}
              data={history.bars}
              endLabel="Hoy"
              goal={history.goalKcal}
              startLabel={formatLocalDate(history.firstDate)}
            />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: colors.primaryBright }]} />
                <Text style={styles.legendText}>Día completo</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
                <Text style={styles.legendText}>Faltan calorías de algún alimento</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.dash} />
                <Text style={styles.legendText}>Tu objetivo ({Math.round(history.goalKcal)} kcal)</Text>
              </View>
            </View>
          </>
        )}
      </Card>

      <AnimatedPressable
        accessibilityLabel="Ver el resumen semanal"
        accessibilityRole="button"
        haptic
        onPress={() => router.push('/summary')}
      >
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>📊</Text>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>Resumen semanal</Text>
            <Text style={styles.summaryCaption}>Media, reparto de macros, agua y peso de la semana</Text>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={22} />
        </Card>
      </AnimatedPressable>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    legend: {
      gap: spacing.sm,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    swatch: {
      borderRadius: 3,
      height: 10,
      width: 14,
    },
    dash: {
      borderColor: colors.textMuted,
      borderStyle: 'dashed',
      borderTopWidth: 2,
      width: 14,
    },
    legendText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    summaryCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    summaryEmoji: {
      fontSize: fontSizes.titleLarge,
      fontFamily: fonts.regular,
    },
    summaryText: {
      flex: 1,
      gap: 2,
    },
    summaryTitle: {
      ...typography.title,
      color: colors.text,
    },
    summaryCaption: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
}
