import { Suspense, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
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

/**
 * Last line of defence: a screen that crashes while rendering shows this instead
 * of a blank page. It reads the system colour scheme directly because the theme
 * provider may be the very thing that failed. (Expo Router picks up this export.)
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const palette = useColorScheme() === 'dark' ? darkColors : lightColors;

  return (
    <View style={[stylesLoading.loading, stylesError.container, { backgroundColor: palette.background }]}>
      <Text style={stylesError.emoji}>😕</Text>
      <Text accessibilityRole="header" style={[stylesError.title, { color: palette.text }]}>
        Algo ha salido mal
      </Text>
      <Text style={[stylesError.body, { color: palette.textMuted }]}>
        Tus datos están a salvo en este móvil. Prueba a reintentarlo y, si vuelve a ocurrir, cierra y
        abre la app.
      </Text>
      {error.message ? (
        <Text numberOfLines={4} selectable style={[stylesError.detail, { color: palette.textMuted }]}>
          {error.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel="Reintentar"
        accessibilityRole="button"
        onPress={() => void retry()}
        style={[stylesError.button, { backgroundColor: palette.primary }]}
      >
        <Text style={[stylesError.buttonText, { color: palette.textOnPrimary }]}>Reintentar</Text>
      </Pressable>
    </View>
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

const stylesError = StyleSheet.create({
  container: {
    gap: 12,
    padding: 24,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  detail: {
    fontSize: 12,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

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
