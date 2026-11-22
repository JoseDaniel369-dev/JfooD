import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { springs } from '@/features/motion/springs';
import { radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

/** Drag farther than this (px) or faster than the velocity below to dismiss. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/** Height of the on-screen keyboard (0 when hidden). */
function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboardHeight;
}

/**
 * A panel that slides up from the bottom. Tap the dimmed area, press back or
 * drag the handle down to close it.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;

  // The Modal stays mounted until the slide-out animation has finished.
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);

  // Mount as soon as it is asked to show (adjusting state while rendering is
  // the supported way to follow a prop); unmount only after sliding out.
  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      translateY.set(height);
      translateY.set(withSpring(0, springs.soft));
    } else {
      translateY.set(
        withTiming(height, { duration: 200 }, (finished) => {
          if (finished) {
            scheduleOnRN(setMounted, false);
          }
        }),
      );
    }
  }, [visible, height, translateY]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          translateY.set(Math.max(0, event.translationY));
        })
        .onEnd((event) => {
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
            scheduleOnRN(onClose);
          } else {
            translateY.set(withSpring(0, springs.soft));
          }
        }),
    [onClose, translateY],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height * 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      {/* Gestures inside a Modal need their own root view on Android. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* The sheet rides above the keyboard; its content scrolls when space runs out. */}
        <View pointerEvents="box-none" style={[styles.keyboard, { paddingBottom: keyboardHeight }]}>
          <Animated.View
            style={[
              styles.sheet,
              {
                maxHeight: (height - keyboardHeight) * 0.92,
                paddingBottom: keyboardOpen ? spacing.lg : Math.max(insets.bottom, spacing.lg),
              },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={drag}>
              <View accessibilityLabel="Arrastra hacia abajo para cerrar" style={styles.handleArea}>
                <View style={styles.handle} />
                {title ? <Text style={styles.title}>{title}</Text> : null}
              </View>
            </GestureDetector>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.overlay,
    },
    keyboard: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    content: {
      gap: spacing.lg,
    },
    handleArea: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    handle: {
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      height: 5,
      width: 44,
    },
    title: {
      ...typography.title,
      color: colors.text,
      textAlign: 'center',
    },
  });
}
