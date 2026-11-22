import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { MacroPill } from '@/components/MacroPill';
import { SectionHeader } from '@/components/SectionHeader';
import { Segmented } from '@/components/Segmented';
import { Skeleton } from '@/components/Skeleton';
import { useMacroHistory } from '@/features/progress/hooks/useMacroHistory';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

const PERIODS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
] as const;

type Period = (typeof PERIODS)[number]['value'];

/** The average day's protein, carbohydrates, fat and fibre against the goals. */
export function MacrosSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [period, setPeriod] = useState<Period>('7');
  const history = useMacroHistory(Number(period));
  const { averages, goals } = history;

  return (
    <Card>
      <SectionHeader
        caption={
          averages && averages.loggedDays > 0
            ? `Media diaria de ${averages.loggedDays} ${averages.loggedDays === 1 ? 'día registrado' : 'días registrados'}`
            : undefined
        }
        title="Macros"
      />
      <Segmented
        accessibilityLabel="Periodo de los macros"
        onChange={setPeriod}
        options={PERIODS}
        value={period}
      />

      {history.loading ? (
        <Skeleton borderRadius={radius.md} height={160} />
      ) : history.failed || !averages || !goals ? (
        <Text style={styles.note}>No se han podido cargar los macros. Vuelve a abrir la sección.</Text>
      ) : averages.loggedDays === 0 ? (
        <EmptyState
          icon="nutrition-outline"
          message="Cuando registres comidas, verás aquí tu media de proteínas, hidratos y grasas."
          title="Aún no hay datos"
        />
      ) : (
        <>
          <MacroPill
            approximate={averages.protein.approximate}
            color={colors.protein}
            goal={goals.proteinGrams}
            label="Proteínas"
            tint={colors.proteinLight}
            value={averages.protein.grams ?? 0}
          />
          <MacroPill
            approximate={averages.carbohydrates.approximate}
            color={colors.carbohydrates}
            goal={goals.carbohydrateGrams}
            label="Hidratos"
            tint={colors.carbohydratesLight}
            value={averages.carbohydrates.grams ?? 0}
          />
          <MacroPill
            approximate={averages.fat.approximate}
            color={colors.fat}
            goal={goals.fatGrams}
            label="Grasas"
            tint={colors.fatLight}
            value={averages.fat.grams ?? 0}
          />

          {averages.split ? (
            <Text style={styles.note}>
              Reparto de la energía: {averages.split.protein} % proteínas · {averages.split.carbohydrates} %
              hidratos · {averages.split.fat} % grasas
            </Text>
          ) : null}

          {averages.fiber.grams !== null ? (
            <View style={styles.fiberRow}>
              <Text style={styles.fiberLabel}>🌾 Fibra</Text>
              <Text style={styles.fiberValue}>
                {averages.fiber.approximate ? '≥ ' : ''}
                {Math.round(averages.fiber.grams)} g de {history.fiberTargetGrams} g
              </Text>
            </View>
          ) : null}

          {averages.protein.approximate || averages.carbohydrates.approximate || averages.fat.approximate ? (
            <Text style={styles.note}>
              «≥» indica que algún alimento no tenía todos sus datos: la media real puede ser mayor.
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    note: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 19,
    },
    fiberRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: spacing.md,
    },
    fiberLabel: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    fiberValue: {
      ...typography.body,
      color: colors.text,
    },
  });
}
