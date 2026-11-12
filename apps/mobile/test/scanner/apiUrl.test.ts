import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApiBaseUrl, getApiBaseUrl, isScannerEnabled } from '../../src/config/api';

function setPublicApiUrl(value: string | undefined) {
  if (value === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = value;
  }
}

test('buildApiBaseUrl extracts host from hostUri', () => {
  assert.equal(buildApiBaseUrl('192.168.1.20:8081'), 'http://192.168.1.20:3000');
});

test('buildApiBaseUrl falls back to localhost', () => {
  assert.equal(buildApiBaseUrl(undefined), 'http://localhost:3000');
});

test('buildApiBaseUrl ignores extra hostUri segments', () => {
  assert.equal(buildApiBaseUrl('10.0.2.2:8081'), 'http://10.0.2.2:3000');
});

test('getApiBaseUrl uses EXPO_PUBLIC_API_URL when set', (context) => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  setPublicApiUrl('https://api.example.com');
  context.after(() => {
    setPublicApiUrl(original);
  });

  assert.equal(getApiBaseUrl(), 'https://api.example.com');
});

test('getApiBaseUrl strips trailing slash from EXPO_PUBLIC_API_URL', (context) => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  setPublicApiUrl('https://api.example.com/');
  context.after(() => {
    setPublicApiUrl(original);
  });

  assert.equal(getApiBaseUrl(), 'https://api.example.com');
});

test('isScannerEnabled returns true when EXPO_PUBLIC_API_URL is set', (context) => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  setPublicApiUrl('https://api.example.com');
  context.after(() => {
    setPublicApiUrl(original);
  });

  assert.equal(isScannerEnabled(), true);
});

test('isScannerEnabled returns false without EXPO_PUBLIC_API_URL and not in dev', (context) => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  setPublicApiUrl(undefined);
  context.after(() => {
    setPublicApiUrl(original);
  });

  assert.equal(isScannerEnabled(), false);
});
