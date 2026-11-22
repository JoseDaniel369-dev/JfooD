import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { fonts, fontSizes, radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Visible label above the field (also used as the accessibility label when none is given). */
  label?: string;
  /** Error message under the field; also paints the border. */
  error?: string | null;
  /** Hint under the field when there is no error. */
  hint?: string | null;
  /** Style of the input itself (alignment, size). */
  inputStyle?: StyleProp<TextStyle>;
  /** Style of the wrapper (flex, margins). */
  style?: StyleProp<ViewStyle>;
}

/**
 * The one text field of the app: label, a 48 dp input in the app font, a visible
 * focus ring and an error line. Replaces the hand-made inputs of each screen.
 */
export function TextField({
  label,
  error,
  hint,
  inputStyle,
  style,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        maxFontSizeMultiplier={1.3}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        {...inputProps}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          inputStyle,
        ]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    label: {
      ...typography.captionStrong,
      color: colors.text,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1.5,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: fontSizes.bodyLarge,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    inputFocused: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    inputError: {
      borderColor: colors.danger,
    },
    error: {
      ...typography.caption,
      color: colors.danger,
    },
    hint: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
}
