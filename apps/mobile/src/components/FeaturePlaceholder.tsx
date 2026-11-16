import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { radius, spacing, useTheme, type ThemeColors } from '@/theme';

interface FeaturePlaceholderProps {
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function FeaturePlaceholder({
  title,
  subtitle,
  description,
  icon,
}: FeaturePlaceholderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen>
      <ScreenHeader title={title} subtitle={subtitle} />
      <Card style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons color={colors.primary} name={icon} size={32} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>En desarrollo</Text>
        </View>
      </Card>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      marginTop: spacing.xl,
      paddingVertical: spacing.xxxl,
    },
    iconContainer: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      height: 68,
      justifyContent: 'center',
      width: 68,
    },
    copy: {
      gap: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    description: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 23,
      textAlign: 'center',
    },
    badge: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    badgeText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
