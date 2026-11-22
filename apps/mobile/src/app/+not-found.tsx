import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useTheme, type ThemeColors, fonts, fontSizes } from '@/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Esta pantalla no existe</Text>
      <Link asChild href="/">
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>Volver al inicio</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: colors.background,
      flex: 1,
      gap: spacing.xl,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    title: {
      color: colors.text,
      fontSize: fontSizes.heading,
      fontFamily: fonts.heading,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing.lg,
    },
    buttonText: {
      color: colors.textOnPrimary,
      fontFamily: fonts.semibold,
    },
  });
}
