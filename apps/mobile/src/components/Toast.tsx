import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { durations } from '@/features/motion/motion';

import { fonts, radius, shadows, spacing, typography, useTheme, type ThemeColors } from '@/theme';

export type ToastVariant = 'success' | 'error';

/** A button inside the toast, e.g. "Deshacer" after deleting something. */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3200;
/** A toast with a button stays longer, so there is time to press it. */
const TOAST_WITH_ACTION_DURATION_MS = 5500;

export function ToastProvider({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);
  const currentId = useRef<number | null>(null);

  const clearToast = useCallback((id: number) => {
    if (currentId.current === id) {
      setToast(null);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      // Reduced motion: durations are 0 and the toast just disappears.
      translateY.set(withTiming(-12, { duration: durations.fast }));
      opacity.set(
        withTiming(0, { duration: durations.fast }, (finished) => {
          if (finished) scheduleOnRN(clearToast, id);
        }),
      );
    },
    [clearToast, opacity, translateY],
  );

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', action?: ToastAction) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      nextId.current += 1;
      const id = nextId.current;
      currentId.current = id;
      setToast({ id, message, variant, action });
      opacity.set(0);
      translateY.set(-12);
      opacity.set(withTiming(1, { duration: durations.normal }));
      translateY.set(withTiming(0, { duration: durations.normal }));
      // Android announces live regions by itself; iOS needs to be told.
      void AccessibilityInfo.announceForAccessibility(message);

      hideTimer.current = setTimeout(
        () => dismiss(id),
        action ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS,
      );
    },
    [dismiss, opacity, translateY],
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          pointerEvents={toast.action ? 'box-none' : 'none'}
          style={[
            styles.toast,
            { top: insets.top + 12 },
            animatedStyle,
            toast.variant === 'error' ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <Ionicons
            color={toast.variant === 'error' ? colors.onDanger : colors.onHero}
            name={
              toast.variant === 'error' ? 'alert-circle' : 'checkmark-circle'
            }
            size={20}
          />
          <Text
            style={[
              styles.toastText,
              toast.variant === 'error' && styles.toastTextError,
            ]}
          >
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                const { action, id } = toast;
                if (hideTimer.current) {
                  clearTimeout(hideTimer.current);
                }
                dismiss(id);
                action?.onPress();
              }}
              style={styles.toastAction}
            >
              <Text style={styles.toastActionText}>{toast.action.label}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider.');
  }
  return context;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    toast: {
      alignItems: 'center',
      borderRadius: radius.pill,
      flexDirection: 'row',
      gap: spacing.sm,
      left: spacing.xl,
      maxWidth: 420,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      position: 'absolute',
      right: spacing.xl,
      ...shadows.md,
    },
    toastSuccess: {
      backgroundColor: colors.toastSuccess,
    },
    toastError: {
      backgroundColor: colors.danger,
    },
    toastText: {
      ...typography.body,
      color: colors.onHero,
      flexShrink: 1,
      fontFamily: fonts.heading,
    },
    toastAction: {
      borderColor: colors.onHeroMuted,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    toastActionText: {
      ...typography.caption,
      color: colors.onHero,
      fontFamily: fonts.brand,
    },
    toastTextError: {
      color: colors.onDanger,
    },
  });
}
