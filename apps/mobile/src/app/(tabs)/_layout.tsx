import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

/**
 * Base height of the tab bar content (react-navigation's default height without
 * insets). Keep this in sync with the navigator if the default ever changes.
 */
const TAB_BAR_CONTENT_HEIGHT = 49;

/**
 * Defensive floor for the bottom safe area on Android. Some devices report
 * insets.bottom = 0 (gesture navigation with the hint disabled, or OEMs that
 * under-report the navigation bar). 24dp covers the standard gesture area so
 * the tab bar background extends below the system navigation zone instead of
 * letting it overlap the tab bar content.
 */
const MIN_BOTTOM_INSET = 24;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, MIN_BOTTOM_INSET);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { paddingVertical: 5 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // The navigator computes a fixed height (49 + insets.bottom) by
          // default. A style value of `height: undefined` is ignored when
          // React Native flattens style arrays, so it never cancelled the
          // default height. Use an explicit numeric height instead.
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 4,
          paddingBottom: bottomInset,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={typeof color === 'string' ? color : colors.textMuted}
              name={focused ? 'home' : 'home-outline'}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Diario',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={typeof color === 'string' ? color : colors.textMuted}
              name={focused ? 'book' : 'book-outline'}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={typeof color === 'string' ? color : colors.textMuted}
              name={focused ? 'calendar' : 'calendar-outline'}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={typeof color === 'string' ? color : colors.textMuted}
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              color={typeof color === 'string' ? color : colors.textMuted}
              name={focused ? 'person' : 'person-outline'}
              size={22}
            />
          ),
        }}
      />
    </Tabs>
  );
}
