import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

export default function NotFoundScreen() {
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

const styles = StyleSheet.create({
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
    fontSize: 22,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.lg,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
});
