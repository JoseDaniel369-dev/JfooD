import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadEnvironment } from '../src/config/env.js';

test('uses local defaults when Gemini is not configured', () => {
  const environment = loadEnvironment({});

  assert.equal(environment.API_HOST, '0.0.0.0');
  assert.equal(environment.API_PORT, 3000);
  assert.equal(environment.PORT, undefined);
  assert.equal(environment.GEMINI_API_KEY, undefined);
  assert.equal(environment.GEMINI_MODEL, 'gemini-3.5-flash-lite');
});

test('treats an empty Gemini key from .env as missing', () => {
  const environment = loadEnvironment({ GEMINI_API_KEY: '' });

  assert.equal(environment.GEMINI_API_KEY, undefined);
});

test('trims and preserves a configured Gemini key', () => {
  const environment = loadEnvironment({ GEMINI_API_KEY: '  test-key  ' });

  assert.equal(environment.GEMINI_API_KEY, 'test-key');
});

test('prefers PORT over API_PORT when provided', () => {
  const environment = loadEnvironment({ PORT: '8080', API_PORT: '3000' });

  assert.equal(environment.PORT, 8080);
  assert.equal(environment.API_PORT, 3000);
});
