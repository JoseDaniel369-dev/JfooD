import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { colors, radius, spacing } from '@/theme';

interface GramsEditorModalProps {
  visible: boolean;
  foodName: string;
  initialGrams: number;
  onClose: () => void;
  onSave: (grams: number) => void;
}

export function GramsEditorModal({
  visible,
  foodName,
  initialGrams,
  onClose,
  onSave,
}: GramsEditorModalProps) {
  const [value, setValue] = useState(() => String(initialGrams));
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);

    if (
      !Number.isFinite(parsed) ||
      normalized.trim() === '' ||
      parsed <= 0 ||
      parsed > 100_000
    ) {
      setError('Introduce una cantidad válida entre 1 y 100.000 g.');
      return;
    }

    setError(null);
    onSave(parsed);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Card style={styles.dialog}>
          <Text style={styles.title}>Editar cantidad</Text>
          <Text style={styles.subtitle}>{foodName}</Text>

          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setValue}
            selectTextOnFocus
            style={[styles.input, error && styles.inputError]}
            value={value}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.buttonSecondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleSave}
              style={({ pressed }) => [
                styles.button,
                styles.buttonPrimary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.buttonPrimaryText}>Guardar</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(24, 37, 31, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    gap: spacing.md,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: spacing.md,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    padding: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
  },
  buttonPrimaryText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
