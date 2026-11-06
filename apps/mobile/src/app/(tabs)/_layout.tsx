import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

/**
 * Android gesture navigation can report a bottom inset of 0 while the system
 * gesture area still overlays the screen, so enforce a minimum bottom padding.
 */
const MIN_TAB_BAR_BOTTOM_PADDING = 12;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

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
          // Explicit bottom inset so the bar always clears the Android system
          // navigation area. This style wins over the navigator's automatic
          // `paddingBottom: insets.bottom`, making the behavior deterministic.
          // `height: undefined` cancels the navigator's fixed height
          // (`49 + inset`) so the bar is content-sized and the padding below
          // can never squeeze the icons or labels.
          height: undefined,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, MIN_TAB_BAR_BOTTOM_PADDING),
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
