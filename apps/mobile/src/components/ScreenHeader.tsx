import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface ScreenHeaderProps {
  /** Title of a tab screen. Leave it out on screens that already have a native header title. */
  title?: string;
  subtitle?: string;
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {title ? (
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.title}>
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.xs,
    },
    title: {
      ...typography.titleLarge,
      color: colors.text,
    },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
  });
}
