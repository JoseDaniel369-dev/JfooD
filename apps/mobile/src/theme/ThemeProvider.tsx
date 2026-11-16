import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getSetting,
  setSetting,
} from '@/data/sqlite/repositories/settingsRepository';
import {
  darkColors,
  lightColors,
  type ThemeColors,
} from '@/theme/tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_SETTING_KEY = 'theme';

function resolvePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function resolveScheme(
  preference: ThemePreference,
  systemScheme: ColorScheme,
): ColorScheme {
  return preference === 'system' ? systemScheme : preference;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const systemScheme = useColorScheme() ?? 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await getSetting(database, THEME_SETTING_KEY);
        if (!cancelled) {
          setPreferenceState(resolvePreference(stored));
        }
      } catch {
        // Keep the system preference if the setting cannot be read.
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [database]);

  const setPreference = useCallback(
    async (nextPreference: ThemePreference) => {
      setPreferenceState(nextPreference);
      try {
        await setSetting(database, THEME_SETTING_KEY, nextPreference);
      } catch {
        throw new Error('No se ha podido guardar la preferencia de tema.');
      }
    },
    [database],
  );

  const scheme = resolveScheme(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor:
            scheme === 'dark' ? darkColors.background : lightColors.background,
        }}
      />
    );
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider.');
  }
  return context;
}
