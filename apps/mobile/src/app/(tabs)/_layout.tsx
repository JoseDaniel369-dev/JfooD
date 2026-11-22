import { Tabs, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { ActionSheet } from '@/components/ActionSheet';
import { AppTabBar } from '@/components/AppTabBar';
import { isScannerEnabled } from '@/config/api';
import { getSetting } from '@/data/sqlite/repositories/settingsRepository';
import { toLocalDate } from '@/features/diary/utils/date';
import { currentDefaultMeal } from '@/features/diary/utils/meals';
import { useTheme, type ThemeColors } from '@/theme';

const ONBOARDING_DONE_KEY = 'onboarding_done';

export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const database = useSQLiteContext();
  const router = useRouter();
  const [gateChecked, setGateChecked] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const quickActions = [
    {
      label: 'Añadir comida',
      icon: 'restaurant-outline' as const,
      onPress: () =>
        router.push({
          pathname: '/diary/add-food',
          params: { date: toLocalDate(new Date()), meal: currentDefaultMeal() },
        }),
    },
    ...(isScannerEnabled()
      ? [
          {
            label: 'Escanear comida',
            icon: 'camera-outline' as const,
            onPress: () => router.push('/scanner'),
          },
          {
            label: 'Escanear código de barras',
            icon: 'barcode-outline' as const,
            onPress: () =>
              router.push({
                pathname: '/barcode',
                params: { date: toLocalDate(new Date()), meal: currentDefaultMeal() },
              }),
          },
        ]
      : []),
    {
      label: 'Añadir al plan',
      icon: 'calendar-outline' as const,
      onPress: () =>
        router.push({
          pathname: '/diary/add-food',
          params: {
            date: toLocalDate(new Date()),
            meal: currentDefaultMeal(),
            target: 'plan',
          },
        }),
    },
    {
      label: 'Registrar peso',
      icon: 'scale-outline' as const,
      onPress: () => router.push('/(tabs)/progress'),
    },
  ];

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
    <>
      <ActionSheet
        options={quickActions}
        title="¿Qué quieres hacer?"
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
        }}
        tabBar={(props) => <AppTabBar {...props} onAdd={() => setQuickAddOpen(true)} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="diary" options={{ title: 'Diario' }} />
        <Tabs.Screen name="add" options={{ title: 'Añadir' }} />
        <Tabs.Screen name="planner" options={{ title: 'Plan' }} />
        <Tabs.Screen name="progress" options={{ title: 'Progreso' }} />
        <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
      </Tabs>
    </>
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
  });
}
