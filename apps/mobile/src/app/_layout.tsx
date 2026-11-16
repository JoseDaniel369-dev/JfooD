import { Suspense, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { ToastProvider } from '@/components/Toast';
import { migrateDatabase } from '@/data/sqlite/migrate';
import {
  ThemeProvider,
  useTheme,
  type ThemeColors,
} from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return (
    <SafeAreaProvider>
      <Suspense fallback={<AppLoading />}>
        <SQLiteProvider
          databaseName="jfood.db"
          onInit={migrateDatabase}
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
  );
}

function RootNavigator() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

function AppLoading() {
  return (
    <View style={stylesLoading.loading}>
      <ActivityIndicator color="#047857" size="large" />
    </View>
  );
}

const stylesLoading = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#F3F8F4',
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
