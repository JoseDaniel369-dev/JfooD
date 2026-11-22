import { Suspense, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { ToastProvider } from '@/components/Toast';
import { useReminderScheduler } from '@/features/reminders/useReminderScheduler';
import { initializeDatabase } from '@/data/sqlite/initializeDatabase';
import {
  darkColors,
  lightColors,
  ThemeProvider,
  useTheme,
  type ThemeColors,
} from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return (
    <GestureHandlerRootView style={stylesLoading.root}>
      <SafeAreaProvider>
        <Suspense fallback={<AppLoading />}>
          <SQLiteProvider
            databaseName="jfood.db"
            onInit={initializeDatabase}
            useSuspense
          >
            <ThemeProvider>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </ThemeProvider>
          </SQLiteProvider>
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useReminderScheduler();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
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
            animation: 'slide_from_bottom',
            presentation: 'modal',
            title: 'Añadir',
          }}
        />
        <Stack.Screen
          name="scanner"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
            title: 'Escáner de alimentos',
          }}
        />
        <Stack.Screen name="recipe" options={{ title: 'Receta' }} />
        <Stack.Screen name="summary" options={{ title: 'Resumen semanal' }} />
        <Stack.Screen
          name="barcode"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
            title: 'Código de barras',
          }}
        />
        <Stack.Screen
          name="foods/[id]"
          options={{
            title: 'Alimento',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            animation: 'fade',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>
    </>
  );
}

/** Shown before the saved theme is readable, so it follows the system scheme. */
function AppLoading() {
  const palette = useColorScheme() === 'dark' ? darkColors : lightColors;

  return (
    <View style={[stylesLoading.loading, { backgroundColor: palette.background }]}>
      <ActivityIndicator color={palette.primary} size="large" />
    </View>
  );
}

const stylesLoading = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.background,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
