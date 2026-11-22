import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { SectionHeader } from '@/components/SectionHeader';
import type { Achievement } from '@/features/achievements/achievements';
import { staggerIn } from '@/features/motion/springs';
import { radius, spacing, tabularNumbers, typography, useTheme, type ThemeColors, fontSizes, fonts } from '@/theme';

/** Badges to unlock, each with its progress. */
export function AchievementsSection({ achievements }: { achievements: readonly Achievement[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;

  // Unlocked first, then the closest to unlocking.
  const sorted = useMemo(
    () =>
      [...achievements].sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        return b.progress - a.progress;
      }),
    [achievements],
  );

  return (
    <Card>
      <SectionHeader
        caption={`${unlocked} de ${achievements.length} desbloqueados`}
        title="Logros"
      />
      <View style={styles.list}>
        {sorted.map((achievement, index) => (
          <Animated.View key={achievement.id} entering={staggerIn(index, 35)}>
            <View
              accessible
              accessibilityLabel={`${achievement.title}. ${achievement.description}. ${
                achievement.unlocked
                  ? 'Desbloqueado'
                  : `${Math.min(achievement.current, achievement.target)} de ${achievement.target}`
              }`}
              style={[styles.row, !achievement.unlocked && styles.rowLocked]}
            >
              <View style={[styles.badge, achievement.unlocked && styles.badgeUnlocked]}>
                <Text style={[styles.emoji, !achievement.unlocked && styles.emojiLocked]}>
                  {achievement.emoji}
                </Text>
              </View>
              <View style={styles.text}>
                <Text style={styles.title}>{achievement.title}</Text>
                <Text style={styles.description}>{achievement.description}</Text>
                {achievement.unlocked ? null : (
                  <View style={styles.progress}>
                    <View style={styles.progressBar}>
                      <ProgressBar
                        color={colors.primaryBright}
                        maximum={achievement.target}
                        value={achievement.current}
                      />
                    </View>
                    <Text style={styles.count}>
                      {Math.min(achievement.current, achievement.target)}/{achievement.target}
                    </Text>
                  </View>
                )}
              </View>
              {achievement.unlocked ? (
                <Ionicons color={colors.successText} name="checkmark-circle" size={24} />
              ) : null}
            </View>
          </Animated.View>
        ))}
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      gap: spacing.lg,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    rowLocked: {
      opacity: 0.9,
    },
    badge: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    badgeUnlocked: {
      backgroundColor: colors.carbohydratesLight,
      borderColor: colors.celebrate,
      borderWidth: 2,
    },
    emoji: {
      fontSize: fontSizes.titleLarge,
      fontFamily: fonts.regular,
    },
    emojiLocked: {
      opacity: 0.4,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...typography.title,
      color: colors.text,
      fontSize: fontSizes.bodyLarge,
    },
    description: {
      ...typography.caption,
      color: colors.textMuted,
    },
    progress: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    progressBar: {
      flex: 1,
    },
    count: {
      ...typography.caption,
      ...tabularNumbers,
      color: colors.textMuted,
    },
  });
}
