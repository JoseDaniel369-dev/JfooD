import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { hapticSelection } from '@/features/haptics/haptics';
import { springs } from '@/features/motion/springs';
import { glow, radius, typography, useTheme, type ThemeColors, fontSizes } from '@/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const CONTENT_HEIGHT = 56;
/**
 * Space kept under the icons. Some Android devices under-report the bottom
 * inset in edge-to-edge mode and the system navigation covered the labels.
 */
const MIN_BOTTOM_INSET = 48;
const PILL_WIDTH = 52;

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'home', off: 'home-outline' },
  diary: { on: 'book', off: 'book-outline' },
  planner: { on: 'calendar', off: 'calendar-outline' },
  progress: { on: 'stats-chart', off: 'stats-chart-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

/** The route that opens the quick-add menu instead of a screen. */
const ADD_ROUTE = 'add';

/**
 * Bottom navigation: a pill slides under the active tab and the central "+"
 * opens the quick-add menu.
 */
export function AppTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets: barInsets,
  onAdd,
}: TabBarProps & { onAdd: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // A reported inset is trusted (plus a little air); a missing one gets the floor.
  const bottomInset = barInsets.bottom > 0 ? Math.max(barInsets.bottom + 8, 16) : MIN_BOTTOM_INSET;
  const [width, setWidth] = useState(0);

  const slot = width > 0 ? width / state.routes.length : 0;
  const pillX = useSharedValue(0);

  useEffect(() => {
    pillX.set(withSpring(state.index * slot + (slot - PILL_WIDTH) / 2, springs.soft));
  }, [pillX, slot, state.index]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const activeRoute = state.routes[state.index]?.name;
  const showPill = slot > 0 && activeRoute !== ADD_ROUTE;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.bar, { height: CONTENT_HEIGHT + bottomInset, paddingBottom: bottomInset }]}
    >
      {showPill ? <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} /> : null}

      {state.routes.map((route, index) => {
        if (route.name === ADD_ROUTE) {
          return (
            <View key={route.key} style={styles.slot}>
              <AnimatedPressable
                accessibilityLabel="Añadir"
                accessibilityRole="button"
                onPress={() => {
                  hapticSelection();
                  onAdd();
                }}
                scaleTo={0.9}
                style={styles.addButton}
              >
                <Ionicons color={colors.textOnPrimary} name="add" size={32} />
              </AnimatedPressable>
            </View>
          );
        }

        const focused = state.index === index;
        const icon = ICONS[route.name];
        const label = descriptors[route.key]?.options.title ?? route.name;

        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            hapticSelection();
            navigateToTab(route.key);
          }
        };

        return (
          <AnimatedPressable
            key={route.key}
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            scaleTo={0.9}
            style={styles.slot}
          >
            <Ionicons
              color={focused ? colors.primary : colors.textMuted}
              name={icon ? (focused ? icon.on : icon.off) : 'ellipse-outline'}
              size={23}
            />
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={[styles.label, focused && styles.labelFocused]}
            >
              {label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      paddingTop: 6,
    },
    pill: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.pill,
      height: 32,
      left: 0,
      position: 'absolute',
      top: 8,
      width: PILL_WIDTH,
    },
    slot: {
      alignItems: 'center',
      flex: 1,
      gap: 2,
      justifyContent: 'flex-start',
      paddingTop: 5,
    },
    label: {
      ...typography.label,
      color: colors.textMuted,
      fontSize: fontSizes.micro,
      letterSpacing: 0.2,
    },
    labelFocused: {
      color: colors.primary,
    },
    addButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      height: 54,
      justifyContent: 'center',
      marginTop: -10,
      width: 54,
      ...glow(colors.primaryBright, 0.45),
    },
  });
}
