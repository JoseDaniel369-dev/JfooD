import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, test } from 'node:test';

const require = createRequire(import.meta.url);
const buildConfig = require('../../app.config.js') as (ctx: { config: object }) => {
  name: string;
  version: string;
  android: { package: string; blockedPermissions: string[] };
  plugins: unknown[];
};

const original = process.env.EXPO_PUBLIC_API_URL;
const originalVariant = process.env.APP_VARIANT;
afterEach(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = original;
  if (originalVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = originalVariant;
});

test('a development build declares the camera even without an API URL', () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  process.env.APP_VARIANT = 'development';
  const config = buildConfig({ config: {} });

  assert.equal(config.android.package, 'com.jfood.app.experimental');
  assert.equal(config.android.blockedPermissions.includes('android.permission.CAMERA'), false);
  assert.equal(pickerOptions(config.plugins)?.cameraPermission !== false, true);
});

function pickerOptions(plugins: unknown[]) {
  const entry = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as
    | [string, Record<string, unknown>]
    | undefined;
  return entry?.[1];
}

test('stable build: offline package, no camera, photo or microphone permissions', () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  const config = buildConfig({ config: {} });

  assert.equal(config.android.package, 'com.jfood.app');
  const options = pickerOptions(config.plugins);
  assert.equal(options?.cameraPermission, false);
  assert.equal(options?.photosPermission, false);
  assert.equal(options?.microphonePermission, false);
});

test('release version and permissions the app never uses are blocked', () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  const stable = buildConfig({ config: {} });
  assert.equal(stable.version, '0.2.0');
  assert.ok(stable.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
  assert.ok(stable.android.blockedPermissions.includes('android.permission.CAMERA'), 'offline build has no camera');

  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  const experimental = buildConfig({ config: {} });
  assert.ok(experimental.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
  assert.equal(experimental.android.blockedPermissions.includes('android.permission.CAMERA'), false, 'the scanner needs it');
});

test('the camera plugin follows the same rules as the image picker', () => {
  const find = (plugins: unknown[]) =>
    (plugins.find((p) => Array.isArray(p) && p[0] === 'expo-camera') as
      | [string, Record<string, unknown>]
      | undefined)?.[1];

  delete process.env.EXPO_PUBLIC_API_URL;
  const stable = find(buildConfig({ config: {} }).plugins);
  assert.equal(stable?.cameraPermission, false);
  assert.equal(stable?.microphonePermission, false);
  assert.equal(stable?.recordAudioAndroid, false);

  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  const experimental = find(buildConfig({ config: {} }).plugins);
  assert.equal(typeof experimental?.cameraPermission, 'string');
  assert.equal(experimental?.microphonePermission, false);
});

test('experimental build: own package, camera allowed, microphone never requested', () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  const config = buildConfig({ config: {} });

  assert.equal(config.android.package, 'com.jfood.app.experimental');
  const options = pickerOptions(config.plugins);
  assert.equal(typeof options?.cameraPermission, 'string');
  assert.equal(options?.microphonePermission, false);
});

test('builds fail early with the placeholder or an insecure API URL', () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://TU_API.onrender.com';
  assert.throws(() => buildConfig({ config: {} }), /TU_API/);

  process.env.EXPO_PUBLIC_API_URL = 'http://example.com';
  assert.throws(() => buildConfig({ config: {} }), /HTTPS/);

  process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.20:3000';
  assert.doesNotThrow(() => buildConfig({ config: {} }));
});

test('the EAS project id is a UUID and reaches the config (builds need it)', () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  const config = buildConfig({ config: {} }) as { extra?: { eas?: { projectId?: string } } };

  assert.match(config.extra?.eas?.projectId ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('the config keeps the project id of the root app.json (eas init) in sync', () => {
  const rootApp = JSON.parse(readFileSync(new URL('../../../../app.json', import.meta.url), 'utf8')) as {
    expo: { extra: { eas: { projectId: string } } };
  };
  const config = buildConfig({ config: {} }) as { extra?: { eas?: { projectId?: string } } };

  assert.equal(config.extra?.eas?.projectId, rootApp.expo.extra.eas.projectId);
});

test('eas.json: each build gets its own environment and an APK, and the offline build has no API', () => {
  const eas = JSON.parse(readFileSync(new URL('../../eas.json', import.meta.url), 'utf8')) as {
    cli: { appVersionSource: string };
    build: Record<string, { environment: string; autoIncrement: boolean; android: { buildType: string }; env?: Record<string, string> }>;
  };

  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.estable?.environment, 'production');
  assert.equal(eas.build.experimental?.environment, 'preview');
  for (const name of ['estable', 'experimental']) {
    const profile = eas.build[name];
    assert.equal(profile?.android.buildType, 'apk', name);
    assert.equal(profile?.autoIncrement, true, name);
  }
  // The development client declares the camera through APP_VARIANT (see app.config.js).
  assert.equal(eas.build.development?.android.buildType, 'apk');
  assert.equal(eas.build.development?.env?.APP_VARIANT, 'development');
  assert.equal(eas.build.estable?.env, undefined, 'the offline build must not point at an API');
});

test('react-native-worklets resolves from Reanimated (its Gradle task fails the Android build otherwise)', () => {
  // Reanimated's build.gradle.kts runs scripts/validate-worklets-build.js, which does
  // require('react-native-worklets/package.json') from Reanimated's own folder. In this
  // monorepo the package must therefore be installed next to Reanimated (root node_modules),
  // not nested in apps/mobile/node_modules (the root package.json declares it for that reason).
  const reanimatedRequire = createRequire(require.resolve('react-native-reanimated/package.json'));
  const worklets = reanimatedRequire('react-native-worklets/package.json') as { version: string };

  assert.match(worklets.version, /^0\.13\./);
});
