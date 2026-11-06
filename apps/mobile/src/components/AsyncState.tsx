import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

export function LoadingState() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.message}>Cargando tus datos…</Text>
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
    justifyContent: 'center',
    minHeight: 280,
    padding: spacing.xl,
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
