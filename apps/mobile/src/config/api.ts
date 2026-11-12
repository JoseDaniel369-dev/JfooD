export function buildApiBaseUrl(hostUri: string | undefined): string {
  const host = hostUri?.split(':')[0]?.trim();
  return `http://${host || 'localhost'}:3000`;
}

function isDevelopment(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isScannerEnabled(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_API_URL) || isDevelopment();
}

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (isDevelopment()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require('expo-constants') as typeof import('expo-constants');
      const constants = 'default' in Constants ? Constants.default : Constants;
      return buildApiBaseUrl(constants?.expoConfig?.hostUri);
    } catch {
      return buildApiBaseUrl(undefined);
    }
  }

  return buildApiBaseUrl(undefined);
}
