import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PartialNutrient } from '@jfood/core';

import { Card } from '@/components/Card';
import { ProgressRing } from '@/components/ProgressRing';
import {
  describeUnknown,
  formatPartialAmount,
  remainingCalories,
  type ExtraTotal,
} from '@/features/diary/utils/totals';
import { useCountUp } from '@/features/motion/useCountUp';
import {
  fontSizes,
  gradients,
  onHeroTrack,
  spacing,
  tabularNumbers,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

interface CalorieHeroProps {
  /** Calories eaten (known part, and whether it is complete). */
  kcal: PartialNutrient;
  goalKcal: number;
  /** Fibre, sugars and salt against their references (shown under the numbers). */
  extras?: ExtraTotal[];
  /** True when the goals are the defaults, not calculated from the profile. */
  goalsAreDefault?: boolean;
}

/**
 * The calorie summary of a day: a ring with what is left, what was eaten and
 * the goal. Home and Diary both show it, so the number looks the same on both.
 */
export function CalorieHero({ kcal, goalKcal, extras = [], goalsAreDefault = false }: CalorieHeroProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const remaining = remainingCalories(goalKcal, kcal);
  const unknownNotice = describeUnknown(kcal);

  return (
    <Card variant="hero">
      <View style={styles.row}>
        <ProgressRing
          accessibilityLabel={`${formatPartialAmount(kcal)} de ${Math.round(goalKcal)} kilocalorías`}
          gradient={gradients.accent}
          maximum={goalKcal}
          size={136}
          strokeWidth={13}
          value={kcal.knownTotal}
        >
          <HeroNumber
            prefix={remaining.approximate ? (remaining.over ? '≥ ' : '≤ ') : ''}
            style={styles.ringValue}
            value={remaining.amount}
          />
          <Text maxFontSizeMultiplier={1.2} style={styles.ringLabel}>
            {remaining.over ? 'de más' : 'restantes'}
          </Text>
        </ProgressRing>

        <View style={styles.main}>
          <Text style={styles.label}>HAS COMIDO</Text>
          <HeroNumber prefix={kcal.complete ? '' : '≥ '} style={styles.eaten} value={kcal.knownTotal} />
          <Text maxFontSizeMultiplier={1.2} style={styles.goal}>
            de {Math.round(goalKcal)} kcal
          </Text>
        </View>
      </View>

      {extras.length > 0 ? (
        <View style={styles.extras}>
          {extras.map((extra) => (
            <View
              key={extra.key}
              accessible
              accessibilityLabel={`${extra.label}: ${extra.amount} gramos, ${extra.target}${extra.exceeded ? ', superado' : ''}`}
              style={styles.extra}
            >
              <Text style={styles.extraLabel}>{extra.label.toUpperCase()}</Text>
              <View style={styles.extraValueRow}>
                <Text style={[styles.extraValue, extra.exceeded && styles.extraExceeded]}>
                  {extra.amount} g
                </Text>
                {extra.exceeded ? (
                  <Ionicons color={colors.celebrate} name="alert-circle" size={15} />
                ) : null}
              </View>
              <Text style={styles.extraTarget}>{extra.target}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {unknownNotice ? (
        <Text style={styles.notice}>{unknownNotice}. Completa sus datos para ver el total real.</Text>
      ) : null}
      {goalsAreDefault ? (
        <Text style={styles.notice}>
          Objetivos provisionales: no calculados con tus datos personales.
        </Text>
      ) : null}
    </Card>
  );
}

/** A big number that counts up to its value and shrinks instead of overflowing. */
function HeroNumber({
  value,
  prefix = '',
  style,
}: {
  value: number;
  prefix?: string;
  style: object;
}) {
  const { colors } = useTheme();
  const display = useCountUp(value, 600, 0);
  return (
    <Text
      adjustsFontSizeToFit
      maxFontSizeMultiplier={1.2}
      minimumFontScale={0.6}
      numberOfLines={1}
      style={[style, { color: colors.onHero }]}
    >
      {`${prefix}${String(display)}`}
    </Text>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xl,
    },
    ringValue: {
      ...typography.display,
      ...tabularNumbers,
      maxWidth: 100,
    },
    ringLabel: {
      ...typography.caption,
      color: colors.onHeroMuted,
    },
    main: {
      flex: 1,
      gap: 2,
    },
    label: {
      ...typography.label,
      color: colors.onHeroMuted,
    },
    eaten: {
      ...typography.displayLarge,
      ...tabularNumbers,
      fontSize: fontSizes.numeral,
      lineHeight: 46,
    },
    goal: {
      ...typography.body,
      color: colors.onHeroMuted,
    },
    extras: {
      borderTopColor: onHeroTrack,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: spacing.md,
      paddingTop: spacing.lg,
    },
    extra: {
      flex: 1,
      gap: 2,
    },
    extraLabel: {
      ...typography.label,
      color: colors.onHeroMuted,
    },
    extraValueRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    extraValue: {
      ...typography.bodyStrong,
      ...tabularNumbers,
      color: colors.onHero,
    },
    extraExceeded: {
      textDecorationLine: 'underline',
    },
    extraTarget: {
      ...typography.micro,
      color: colors.onHeroMuted,
    },
    notice: {
      ...typography.caption,
      color: colors.onHeroMuted,
    },
  });
}
