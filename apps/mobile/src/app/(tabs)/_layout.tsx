import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSetting } from '@/data/sqlite/repositories/settingsRepository';
import { hapticSelection } from '@/features/haptics/haptics';
import { radius, useTheme, type ThemeColors } from '@/theme';

const TAB_BAR_CONTENT_HEIGHT = 56;

const MIN_BOTTOM_INSET = 64;

const ONBOARDING_DONE_KEY = 'onboarding_done';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = Math.max(insets.bottom, MIN_BOTTOM_INSET);

  const database = useSQLiteContext();
  const router = useRouter();
  const [gateChecked, setGateChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const done = await getSetting(database, ONBOARDING_DONE_KEY);
        if (!cancelled && done !== '1') {
          router.replace('/onboarding');
          return;
        }
      } catch {
        // Fall through to the tabs if the setting cannot be read.
      }
      if (!cancelled) {
        setGateChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [database, router]);

  if (!gateChecked) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { paddingVertical: 5 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
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
            <TabIcon
              color={typeof color === 'string' ? color : colors.textMuted}
              colors={colors}
              focused={focused}
              name={focused ? 'home' : 'home-outline'}
            />
          ),
        }}
        listeners={{
          tabPress: () => hapticSelection(),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Diario',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={typeof color === 'string' ? color : colors.textMuted}
              colors={colors}
              focused={focused}
              name={focused ? 'book' : 'book-outline'}
            />
          ),
        }}
        listeners={{
          tabPress: () => hapticSelection(),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={typeof color === 'string' ? color : colors.textMuted}
              colors={colors}
              focused={focused}
              name={focused ? 'calendar' : 'calendar-outline'}
            />
          ),
        }}
        listeners={{
          tabPress: () => hapticSelection(),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={typeof color === 'string' ? color : colors.textMuted}
              colors={colors}
              focused={focused}
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
            />
          ),
        }}
        listeners={{
          tabPress: () => hapticSelection(),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={typeof color === 'string' ? color : colors.textMuted}
              colors={colors}
              focused={focused}
              name={focused ? 'person' : 'person-outline'}
            />
          ),
        }}
        listeners={{
          tabPress: () => hapticSelection(),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  color,
  colors,
  focused,
  name,
}: {
  color: string;
  colors: ThemeColors;
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [scale] = useState(() => new Animated.Value(focused ? 1.05 : 1));

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.05 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 200,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View
      style={[
        styles.iconPill,
        focused && styles.iconPillActive,
        { transform: [{ scale }] },
      ]}
    >
      <Ionicons
        color={typeof color === 'string' ? color : colors.textMuted}
        name={name}
        size={21}
      />
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    gate: {
      alignItems: 'center',
      backgroundColor: colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    iconPill: {
      alignItems: 'center',
      borderRadius: radius.pill,
      height: 30,
      justifyContent: 'center',
      width: 48,
    },
    iconPillActive: {
      backgroundColor: colors.primaryLight,
    },
  });
}
