import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme, type ThemeColors } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  contentContainerStyle?: StyleProp<ViewStyle>;
  fab?: boolean;
}

export function Screen({ children, contentContainerStyle, fab = false }: ScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, fab), [colors, fab]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
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
  });
}
