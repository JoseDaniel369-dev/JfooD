import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card } from '@/components/Card';
import { durations, easings, springConfigs } from '@/features/motion/motion';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

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

  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.9));
  const [isOpen, setIsOpen] = useState(visible);
  // Kept mounted while the close animation runs; a reopened dialog is shown again.
  if (visible && !isOpen) setIsOpen(true);
  const onCloseRef = useRef(onClose);
  /** True while the dialog is on screen (starts as `visible`, so a dialog mounted closed never "closes"). */
  const openRef = useRef(visible);
  /** True from the first close request until the close animation ends: later taps are ignored. */
  const closingRef = useRef(false);
  const closeTokenRef = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const runClose = useCallback(
    (afterClose?: () => void) => {
      if (closingRef.current || !openRef.current) return;
      closingRef.current = true;
      const token = closeTokenRef.current;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: durations.fast,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: durations.fast,
          useNativeDriver: true,
          easing: (x) => easings.easeInOutCubic(x),
        }),
      ]).start(({ finished }) => {
        // Interrupted (the dialog was reopened meanwhile): the new open owns the state.
        if (!finished || token !== closeTokenRef.current) return;
        closingRef.current = false;
        openRef.current = false;
        setIsOpen(false);
        onCloseRef.current();
        afterClose?.();
      });
    },
    [opacity, scale],
  );

  useEffect(() => {
    if (visible) {
      closeTokenRef.current += 1;
      closingRef.current = false;
      openRef.current = true;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: durations.normal,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          ...springConfigs.gentle,
        }),
      ]).start();
    } else {
      // Closed by the parent (not through runClose): animate out once.
      runClose();
    }
  }, [visible, opacity, scale, runClose]);


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
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
          onPress={() => runClose()}
          style={styles.backdropPressable}
        />
      </Animated.View>
      <View style={styles.dialogContainer} pointerEvents="box-none">
        <Animated.View style={[styles.dialogWrapper, { opacity, transform: [{ scale }] }]}>
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
      fontWeight: '700',
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
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
