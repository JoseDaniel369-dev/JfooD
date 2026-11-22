import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hapticSelection } from '@/features/haptics/haptics';
import { durations, easings, springConfigs } from '@/features/motion/motion';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

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

/** Distance the sheet starts from (and returns to) below the screen. */
const SHEET_OFFSCREEN = 640;

export function ActionSheet({ visible, title, options, onClose }: ActionSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(SHEET_OFFSCREEN));
  const [isOpen, setIsOpen] = useState(visible);
  // Kept mounted while the close animation runs; a reopened sheet is shown again.
  if (visible && !isOpen) setIsOpen(true);
  const onCloseRef = useRef(onClose);
  const animRef = useRef({ opacity, translateY });
  /** True while the sheet is on screen (a sheet mounted closed never "closes"). */
  const openRef = useRef(visible);
  /** True from the first close request until the animation ends: later taps are ignored. */
  const closingRef = useRef(false);
  const closeTokenRef = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    animRef.current = { opacity, translateY };
  }, [opacity, translateY]);

  const runCloseAnimation = useCallback((afterClose?: () => void) => {
    if (closingRef.current || !openRef.current) return;
    closingRef.current = true;
    const token = closeTokenRef.current;
    const { opacity: op, translateY: ty } = animRef.current;
    Animated.parallel([
      Animated.timing(op, {
        toValue: 0,
        duration: durations.fast,
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: SHEET_OFFSCREEN,
        duration: durations.normal,
        useNativeDriver: true,
        easing: (x) => easings.easeInOutCubic(x),
      }),
    ]).start(({ finished }) => {
      // Interrupted (reopened meanwhile): the new open owns the state.
      if (!finished || token !== closeTokenRef.current) return;
      closingRef.current = false;
      openRef.current = false;
      setIsOpen(false);
      onCloseRef.current();
      afterClose?.();
    });
  }, []);

  const runOpenAnimation = useCallback(() => {
    const { opacity: op, translateY: ty } = animRef.current;
    Animated.parallel([
      Animated.timing(op, {
        toValue: 1,
        duration: durations.normal,
        useNativeDriver: true,
      }),
      Animated.spring(ty, {
        toValue: 0,
        useNativeDriver: true,
        ...springConfigs.gentle,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (visible) {
      closeTokenRef.current += 1;
      closingRef.current = false;
      openRef.current = true;
      runOpenAnimation();
    } else {
      // Closed by the parent (not through a tap): animate out once.
      runCloseAnimation();
    }
  }, [visible, runOpenAnimation, runCloseAnimation]);

  const handleOptionPress = useCallback(
    (option: ActionSheetOption) => {
      hapticSelection();
      runCloseAnimation(() => {
        option.onPress();
      });
    },
    [runCloseAnimation],
  );

  if (!visible && !isOpen) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={() => runCloseAnimation()}
      transparent
      visible={visible || isOpen}
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable
          accessibilityLabel="Cerrar opciones"
          accessibilityRole="button"
          onPress={() => runCloseAnimation()}
          style={styles.backdropPressable}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: spacing.lg + Math.max(insets.bottom, 16),
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.dragHandle} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
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
                <Text
                  style={[
                    styles.optionText,
                    option.destructive && styles.destructiveText,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
          onPress={() => runCloseAnimation()}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </Animated.View>
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
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      position: 'absolute',
      width: '100%',
      bottom: 0,
    },
    dragHandle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: 2,
      height: 4,
      width: 36,
    },
    title: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    options: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    option: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 52,
    },
    optionBorder: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    optionText: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
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
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
