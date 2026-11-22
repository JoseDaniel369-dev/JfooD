import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { hapticSelection } from '@/features/haptics/haptics';
import type { Insight, InsightKind, InsightTone } from '@/features/insights/buildInsights';
import { fadeUp } from '@/features/motion/springs';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

const ICONS: Record<InsightKind, keyof typeof Ionicons.glyphMap> = {
  'goal-reached': 'trophy',
  'over-goal': 'alert-circle',
  'streak-at-risk': 'flame',
  'missing-meal': 'restaurant',
  protein: 'barbell',
  water: 'water',
  fiber: 'leaf',
  'start-day': 'sunny',
};

/**
 * The most relevant tip of the day in one card. When there are more, tapping the
 * card shows the next one and the dots tell how many there are.
 */
export function InsightCarousel({ insights }: { insights: Insight[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [requested, setRequested] = useState(0);

  if (insights.length === 0) return null;

  // The list changes during the day: never point past its end.
  const index = requested % insights.length;
  const insight = insights[index] as Insight;
  const many = insights.length > 1;
  const tone = toneColors(insight.tone, colors);

  return (
    <Pressable
      accessibilityHint={many ? 'Toca para ver otro consejo' : undefined}
      accessibilityLabel={`${insight.title}. ${insight.message}`}
      accessibilityRole={many ? 'button' : 'text'}
      disabled={!many}
      onPress={() => {
        hapticSelection();
        setRequested(index + 1);
      }}
      style={[styles.card, { backgroundColor: tone.background }]}
    >
      <Animated.View entering={fadeUp()} key={insight.kind + insight.title} style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: tone.circle }]}>
          <Ionicons color={tone.icon} name={ICONS[insight.kind]} size={22} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{insight.title}</Text>
          <Text style={styles.message}>{insight.message}</Text>
        </View>
      </Animated.View>
      {many ? (
        <View style={styles.dots}>
          {insights.map((item, dotIndex) => (
            <View
              key={`${item.kind}-${dotIndex}`}
              style={[styles.dot, dotIndex === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function toneColors(tone: InsightTone, colors: ThemeColors) {
  if (tone === 'success') {
    return { background: colors.primaryLight, circle: colors.surface, icon: colors.primary };
  }
  if (tone === 'warning') {
    return { background: colors.carbohydratesLight, circle: colors.surface, icon: colors.warning };
  }
  return { background: colors.surfaceMuted, circle: colors.surface, icon: colors.primary };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      gap: spacing.md,
      padding: spacing.lg,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    iconCircle: {
      alignItems: 'center',
      borderRadius: radius.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...typography.title,
      color: colors.text,
    },
    message: {
      ...typography.body,
      color: colors.text,
    },
    dots: {
      alignSelf: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    dot: {
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      height: 6,
      width: 6,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 18,
    },
  });
}
