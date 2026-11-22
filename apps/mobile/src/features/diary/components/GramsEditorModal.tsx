import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { formatGrams } from '@/features/diary/utils/totals';
import { parseSpanishNumber } from '@/features/foods/utils/parseNumber';
import { hapticSelection } from '@/features/haptics/haptics';
import { spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface GramsEditorModalProps {
  visible: boolean;
  foodName: string;
  initialGrams: number;
  onClose: () => void;
  onSave: (grams: number) => void;
}

/** Changes the amount (in grams) of one diary or plan entry. */
export function GramsEditorModal({
  visible,
  foodName,
  initialGrams,
  onClose,
  onSave,
}: GramsEditorModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [value, setValue] = useState(() => formatGrams(initialGrams));
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const parsed = parseSpanishNumber(value, { thousands: true });

    if (parsed === null || parsed <= 0 || parsed > 100_000) {
      setError('Introduce una cantidad válida: más de 0 y hasta 100.000 g.');
      return;
    }

    setError(null);
    hapticSelection();
    onSave(parsed);
  };

  return (
    <BottomSheet onClose={onClose} title="Editar cantidad" visible={visible}>
      <Text style={styles.subtitle}>{foodName}</Text>
      <TextField
        autoFocus
        error={error}
        inputStyle={styles.input}
        keyboardType="decimal-pad"
        label="Cantidad en gramos"
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        onSubmitEditing={handleSave}
        returnKeyType="done"
        selectTextOnFocus
        value={value}
      />
      <View style={styles.buttons}>
        <View style={styles.buttonFlex}>
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
        </View>
        <View style={styles.buttonFlex}>
          <Button title="Guardar" onPress={handleSave} />
        </View>
      </View>
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
    input: {
      textAlign: 'center',
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    buttonFlex: {
      flex: 1,
    },
  });
}
