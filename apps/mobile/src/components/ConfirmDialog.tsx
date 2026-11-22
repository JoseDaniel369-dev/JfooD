import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Card } from '@/components/Card';
import { durations } from '@/features/motion/motion';
import { springs } from '@/features/motion/springs';
import { fonts, radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const [isOpen, setIsOpen] = useState(visible);
  // Kept mounted while the close animation runs; a reopened dialog is shown again.
  if (visible && !isOpen) setIsOpen(true);
  const onCloseRef = useRef(onClose);
  /** True while the dialog is on screen (starts as `visible`, so a dialog mounted closed never "closes"). */
  const openRef = useRef(visible);
  /** True from the first close request until the close animation ends: later taps are ignored. */
  const closingRef = useRef(false);
  const closeTokenRef = useRef(0);
  /** What to run once the dialog is gone (the confirm action). */
  const afterCloseRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  /** Runs on the JS thread when the close animation really finished. */
  const finishClose = useCallback((token: number) => {
    // Interrupted (the dialog was reopened meanwhile): the new open owns the state.
    if (token !== closeTokenRef.current) return;
    closingRef.current = false;
    openRef.current = false;
    setIsOpen(false);
    onCloseRef.current();
    const afterClose = afterCloseRef.current;
    afterCloseRef.current = undefined;
    afterClose?.();
  }, []);

  const runClose = useCallback(
    (afterClose?: () => void) => {
      if (closingRef.current || !openRef.current) return;
      closingRef.current = true;
      afterCloseRef.current = afterClose;
      const token = closeTokenRef.current;
      scale.set(withTiming(0.92, { duration: durations.fast }));
      opacity.set(
        withTiming(0, { duration: durations.fast }, (finished) => {
          if (finished) scheduleOnRN(finishClose, token);
        }),
      );
    },
    [finishClose, opacity, scale],
  );

  useEffect(() => {
    if (visible) {
      closeTokenRef.current += 1;
      closingRef.current = false;
      openRef.current = true;
      afterCloseRef.current = undefined;
      opacity.set(withTiming(1, { duration: durations.normal }));
      scale.set(withSpring(1, springs.soft));
    } else {
      // Closed by the parent (not through runClose): animate out once.
      runClose();
    }
  }, [visible, opacity, scale, runClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const dialogStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible && !isOpen) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={() => runClose()}
      transparent
      visible={visible || isOpen}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
          onPress={() => runClose()}
          style={styles.backdropPressable}
        />
      </Animated.View>
      <View style={styles.dialogContainer} pointerEvents="box-none">
        <Animated.View style={[styles.dialogWrapper, dialogStyle]}>
          <Card style={styles.dialog}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View style={styles.buttons}>
              <Pressable
                accessibilityLabel={cancelLabel}
                accessibilityRole="button"
                onPress={() => runClose()}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={confirmLabel}
                accessibilityRole="button"
                onPress={() => runClose(() => onConfirm())}
                style={({ pressed }) => [
                  styles.button,
                  destructive ? styles.dangerButton : styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    destructive && styles.dangerButtonText,
                  ]}
                >
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </Card>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.overlay,
    },
    backdropPressable: {
      flex: 1,
    },
    dialogContainer: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    dialogWrapper: {
      width: '100%',
    },
    dialog: {
      gap: spacing.md,
      width: '100%',
    },
    title: {
      ...typography.title,
      color: colors.text,
    },
    message: {
      ...typography.body,
      color: colors.textMuted,
      lineHeight: 20,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      alignItems: 'center',
      borderRadius: radius.md,
      flex: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingVertical: spacing.md,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    dangerButton: {
      backgroundColor: colors.danger,
    },
    primaryButtonText: {
      ...typography.body,
      color: colors.textOnPrimary,
      fontFamily: fonts.heading,
    },
    dangerButtonText: {
      color: colors.onDanger,
    },
    secondaryButton: {
      backgroundColor: colors.surfaceMuted,
    },
    secondaryButtonText: {
      ...typography.body,
      color: colors.text,
      fontFamily: fonts.heading,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
