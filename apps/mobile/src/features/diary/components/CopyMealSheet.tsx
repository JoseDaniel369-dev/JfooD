import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { buildCopyTargets } from '@/features/diary/utils/copyTargets';
import { formatLocalDate, parseLocalDate, toLocalDate } from '@/features/diary/utils/date';
import { spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface CopyMealSheetProps {
  visible: boolean;
  /** "el desayuno", "la cena"… (for the title). */
  mealLabel: string;
  /** The day the meal is on now. */
  fromDate: string;
  onClose: () => void;
  /** Copies the meal to `date`; resolves when done. */
  onCopy: (date: string) => Promise<void>;
}

/** Bottom sheet to choose the day a whole meal is copied to. */
export function CopyMealSheet({ visible, mealLabel, fromDate, onClose, onCopy }: CopyMealSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Set at once: two quick taps on a day must copy once. */
  const busyRef = useRef(false);

  // The iOS calendar has no cancel button: closing the sheet must not leave it open for the next one.
  const close = () => {
    setPicking(false);
    onClose();
  };

  const today = toLocalDate(new Date());
  const targets = buildCopyTargets(today, fromDate);

  const copyTo = async (date: string) => {
    if (busyRef.current || date === fromDate) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onCopy(date);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handlePick = (event: DateTimePickerEvent, selected?: Date) => {
    setPicking(false);
    // A dismissed Android dialog still reports the original date.
    if (event.type === 'set' && selected) {
      void copyTo(toLocalDate(selected));
    }
  };

  return (
    <BottomSheet onClose={close} title={`Copiar ${mealLabel} a…`} visible={visible}>
      <Text style={styles.hint}>
        Desde {formatLocalDate(fromDate)}. Los alimentos se añaden a lo que ya haya ese día.
      </Text>

      <View style={styles.chips}>
        {targets.map((target) => (
          <Chip
            key={target.date}
            accessibilityLabel={`Copiar a ${formatLocalDate(target.date)}`}
            label={target.label}
            onPress={() => void copyTo(target.date)}
          />
        ))}
      </View>

      <Button
        icon="calendar-outline"
        loading={busy}
        title="Elegir otra fecha"
        variant="secondary"
        onPress={() => setPicking(true)}
      />

      {picking ? (
        <DateTimePicker
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          mode="date"
          onChange={handlePick}
          value={parseLocalDate(fromDate) ?? new Date()}
        />
      ) : null}
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hint: {
      ...typography.caption,
      color: colors.textMuted,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
  });
}
