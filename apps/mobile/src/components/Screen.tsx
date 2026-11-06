import type { PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, contentContainerStyle }: ScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
});
