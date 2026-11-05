import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadEnvironment } from '../src/config/env.js';

test('uses local defaults when Gemini is not configured', () => {
  const environment = loadEnvironment({});

  assert.equal(environment.API_HOST, '0.0.0.0');
  assert.equal(environment.API_PORT, 3000);
  assert.equal(environment.GEMINI_API_KEY, undefined);
});

test('treats an empty Gemini key from .env as missing', () => {
  const environment = loadEnvironment({ GEMINI_API_KEY: '' });

  assert.equal(environment.GEMINI_API_KEY, undefined);
});

test('trims and preserves a configured Gemini key', () => {
  const environment = loadEnvironment({ GEMINI_API_KEY: '  test-key  ' });

  assert.equal(environment.GEMINI_API_KEY, 'test-key');
});
