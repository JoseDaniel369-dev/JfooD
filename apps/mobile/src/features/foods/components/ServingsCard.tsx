import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { useToast } from '@/components/Toast';
import {
  deleteServing,
  getServings,
  saveServing,
  MAX_SERVING_LABEL_LENGTH,
  type Serving,
} from '@/data/sqlite/repositories/servingRepository';
import { parseSpanishNumber } from '@/features/foods/utils/parseNumber';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

/** Named portions of a food ("1 unidad = 60 g") used as shortcuts when logging. */
export function ServingsCard({ foodId }: { foodId: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const database = useSQLiteContext();
  const { showToast } = useToast();
  const [servings, setServings] = useState<Serving[]>([]);
  const [label, setLabel] = useState('');
  const [grams, setGrams] = useState('');

  const load = useCallback(async () => {
    try {
      setServings(await getServings(database, foodId));
    } catch {
      showToast('No se han podido cargar las raciones.', 'error');
    }
  }, [database, foodId, showToast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleAdd = async () => {
    try {
      await saveServing(database, foodId, label, parseSpanishNumber(grams, { thousands: true }) ?? Number.NaN);
      setLabel('');
      setGrams('');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se ha podido guardar la ración.', 'error');
    }
  };

  const handleDelete = async (serving: Serving) => {
    try {
      await deleteServing(database, serving.id);
      await load();
    } catch {
      showToast('No se ha podido eliminar la ración.', 'error');
    }
  };

  return (
    <Card>
      <SectionHeader title="Raciones" caption="Atajos para registrar, p. ej. 1 unidad = 60 g" />
      {servings.map((serving) => (
        <View key={serving.id} style={styles.row}>
          <Text style={styles.rowText}>
            {serving.label} · {Math.round(serving.grams * 10) / 10} g
          </Text>
          <Pressable
            accessibilityLabel={`Eliminar ración ${serving.label}`}
            accessibilityRole="button"
            onPress={() => void handleDelete(serving)}
            style={styles.delete}
          >
            <Ionicons color={colors.textMuted} name="close-circle-outline" size={22} />
          </Pressable>
        </View>
      ))}
      <View style={styles.form}>
        <TextInput
          accessibilityLabel="Nombre de la ración"
          maxLength={MAX_SERVING_LABEL_LENGTH}
          onChangeText={setLabel}
          placeholder="Nombre (ej. 1 unidad)"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.labelInput]}
          value={label}
        />
        <TextInput
          accessibilityLabel="Gramos de la ración"
          keyboardType="decimal-pad"
          onChangeText={setGrams}
          placeholder="g"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.gramsInput]}
          value={grams}
        />
      </View>
      <Button
        disabled={label.trim() === '' || grams.trim() === ''}
        icon="add"
        title="Añadir ración"
        variant="secondary"
        onPress={() => void handleAdd()}
      />
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    rowText: { ...typography.body, color: colors.text },
    delete: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
    form: { flexDirection: 'row', gap: spacing.sm },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      minHeight: 48,
      padding: spacing.md,
    },
    labelInput: { flex: 2 },
    gramsInput: { flex: 1 },
  });
}
