export function buildApiBaseUrl(hostUri: string | undefined): string {
  const host = hostUri?.split(':')[0]?.trim();
  return `http://${host || 'localhost'}:3000`;
}

export function getApiBaseUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants') as typeof import('expo-constants');
    const constants = 'default' in Constants ? Constants.default : Constants;
    return buildApiBaseUrl(constants?.expoConfig?.hostUri);
  } catch {
    return buildApiBaseUrl(undefined);
  }
}
