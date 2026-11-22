import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, useTheme, type ThemeColors, fonts } from '@/theme';

interface SectionHeaderProps {
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  caption,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...typography.title,
      color: colors.text,
    },
    caption: {
      ...typography.caption,
      color: colors.textMuted,
    },
    action: {
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.xs,
    },
    actionText: {
      ...typography.caption,
      color: colors.primary,
      fontFamily: fonts.heading,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
