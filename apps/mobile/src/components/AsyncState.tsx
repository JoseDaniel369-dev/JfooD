import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenSkeleton } from '@/components/Skeleton';
import { radius, spacing, useTheme, type ThemeColors, fonts, fontSizes } from '@/theme';

/** Placeholder shapes (with a shimmer) while a screen loads its data. */
export function LoadingState() {
  return (
    <View accessibilityLabel="Cargando tus datos" accessibilityLiveRegion="polite" accessible>
      <ScreenSkeleton />
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Ionicons color={colors.danger} name="alert-circle-outline" size={36} />
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: spacing.lg,
      justifyContent: 'center',
      minHeight: 280,
      padding: spacing.xl,
    },
    message: {
      color: colors.textMuted,
      fontSize: fontSizes.body,
      fontFamily: fonts.regular,
      lineHeight: 22,
      textAlign: 'center',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    buttonText: {
      color: colors.textOnPrimary,
      fontFamily: fonts.semibold,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
