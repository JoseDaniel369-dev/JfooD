import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrateDatabase } from '@/data/sqlite/migrate';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationBar style="dark" />
      <Suspense fallback={<AppLoading />}>
        <SQLiteProvider
          databaseName="jfood.db"
          onInit={migrateDatabase}
          useSuspense
        >
          <Stack
            screenOptions={{
              contentStyle: styles.screen,
              headerShadowVisible: false,
              headerStyle: styles.header,
              headerTintColor: colors.text,
              headerTitleStyle: styles.headerTitle,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="diary/add-food"
              options={{
                presentation: 'modal',
                title: 'Añadir',
              }}
            />
            <Stack.Screen
              name="scanner"
              options={{
                presentation: 'modal',
                title: 'Escáner de alimentos',
              }}
            />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

function AppLoading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
