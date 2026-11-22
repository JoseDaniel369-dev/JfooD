import type { PropsWithChildren, ReactNode, Ref } from 'react';
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme, type ThemeColors } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  contentContainerStyle?: StyleProp<ViewStyle>;
  fab?: boolean;
  /** Lets the screen scroll itself (e.g. to bring a form into view). */
  scrollRef?: Ref<ScrollViewInstance>;
  /** A bar fixed under the scrolling content (the main action of the screen). */
  footer?: ReactNode;
}

export function Screen({
  children,
  contentContainerStyle,
  fab = false,
  scrollRef,
  footer,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, fab), [colors, fab]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, fab: boolean) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      gap: spacing.lg,
      padding: spacing.xl,
      paddingBottom: fab ? 96 : spacing.xxxl,
    },
    footer: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
  });
}
