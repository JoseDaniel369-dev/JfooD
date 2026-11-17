import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, test } from 'node:test';

const require = createRequire(import.meta.url);
const buildConfig = require('../../app.config.js') as (ctx: { config: object }) => {
  name: string;
  android: { package: string };
  plugins: unknown[];
};

const original = process.env.EXPO_PUBLIC_API_URL;
afterEach(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = original;
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
