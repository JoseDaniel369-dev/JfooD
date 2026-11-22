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
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

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
  const opacity = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(-12), []);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);
  const currentId = useRef<number | null>(null);

  const dismiss = useCallback((id: number) => {
    Animated.parallel([
      Animated.timing(opacity, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 180,
        toValue: -12,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (currentId.current === id) {
        setToast(null);
      }
    });
  }, [opacity, translateY]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', action?: ToastAction) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      nextId.current += 1;
      const id = nextId.current;
      currentId.current = id;
      setToast({ id, message, variant, action });
      opacity.setValue(0);
      translateY.setValue(-12);

      Animated.parallel([
        Animated.timing(opacity, {
          duration: 200,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          duration: 200,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();

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
            { top: insets.top + 12, opacity, transform: [{ translateY }] },
            toast.variant === 'error' ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <Ionicons
            color={toast.variant === 'error' ? colors.onDanger : '#FFFFFF'}
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
      elevation: 4,
      flexDirection: 'row',
      gap: spacing.sm,
      left: spacing.xl,
      maxWidth: 420,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      position: 'absolute',
      right: spacing.xl,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    toastSuccess: {
      backgroundColor: colors.toastSuccess,
    },
    toastError: {
      backgroundColor: colors.danger,
    },
    toastText: {
      ...typography.body,
      color: '#FFFFFF',
      flexShrink: 1,
      fontWeight: '700',
    },
    toastAction: {
      borderColor: 'rgba(255,255,255,0.7)',
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    toastActionText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    toastTextError: {
      color: colors.onDanger,
    },
  });
}
