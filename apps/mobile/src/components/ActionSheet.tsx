import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { hapticSelection } from '@/features/haptics/haptics';
import { fonts, radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

export interface ActionSheetOption {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}

/** The sheet slides out in ~200 ms; the chosen action runs once it is gone (a dialog may open next). */
const EXIT_MS = 230;

/**
 * A list of actions in a bottom sheet (same sheet, handle and drag-to-close as
 * every other panel of the app). The chosen action runs once, after the sheet
 * has closed.
 */
export function ActionSheet({ visible, title, options, onClose }: ActionSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  /** True once an option was chosen: a second tap during the exit does nothing. */
  const chosenRef = useRef(false);

  useEffect(() => {
    if (visible) chosenRef.current = false;
  }, [visible]);

  const handleOptionPress = useCallback(
    (option: ActionSheetOption) => {
      if (chosenRef.current) return;
      chosenRef.current = true;
      hapticSelection();
      onClose();
      setTimeout(option.onPress, EXIT_MS);
    },
    [onClose],
  );

  return (
    <BottomSheet onClose={onClose} title={title} visible={visible}>
      <View style={styles.options}>
        {options.map((option, index) => {
          const isLast = index === options.length - 1;
          return (
            <Pressable
              key={option.label}
              accessibilityLabel={option.label}
              accessibilityRole="button"
              onPress={() => handleOptionPress(option)}
              style={({ pressed }) => [
                styles.option,
                !isLast && styles.optionBorder,
                pressed && styles.pressed,
              ]}
            >
              {option.icon ? (
                <Ionicons
                  color={option.destructive ? colors.danger : colors.primary}
                  name={option.icon}
                  size={22}
                />
              ) : null}
              <Text style={[styles.optionText, option.destructive && styles.destructiveText]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityLabel="Cancelar"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    options: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    option: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    optionBorder: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    optionText: {
      ...typography.body,
      color: colors.text,
      fontFamily: fonts.semibold,
    },
    destructiveText: {
      color: colors.danger,
    },
    cancelButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      justifyContent: 'center',
      minHeight: 52,
      paddingVertical: spacing.md,
    },
    cancelText: {
      ...typography.body,
      color: colors.text,
      fontFamily: fonts.heading,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
