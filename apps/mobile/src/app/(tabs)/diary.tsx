import { StyleSheet, Text } from 'react-native';

import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MealList } from '@/features/diary/components/MealList';
import { useDiaryDay } from '@/features/diary/hooks/useDiaryDay';
import { formatLocalDate } from '@/features/diary/utils/date';
import { colors } from '@/theme';

export default function DiaryScreen() {
  const { day, error, loading, localDate, reload } = useDiaryDay();

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !day) {
    return (
      <Screen>
        <ErrorState
          message={error ?? 'No hay datos disponibles.'}
          onRetry={() => void reload()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Diario nutricional"
        subtitle={formatLocalDate(localDate)}
      />
      <Card>
        <Text style={styles.totalLabel}>Total consumido</Text>
        <Text style={styles.totalValue}>
          {day.consumed.caloriesKcal === null
            ? '—'
            : Math.round(day.consumed.caloriesKcal)}
          <Text style={styles.totalUnit}> kcal</Text>
        </Text>
      </Card>
      <Card>
        <MealList meals={day.meals} />
      </Card>
      <Text style={styles.localNote}>
        Tu diario se guarda únicamente en este dispositivo y funciona sin conexión.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  totalLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  totalValue: {
    color: colors.primary,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  totalUnit: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '400',
  },
  localNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
