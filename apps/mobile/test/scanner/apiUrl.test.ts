import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApiBaseUrl } from '../../src/config/api';

test('buildApiBaseUrl extracts host from hostUri', () => {
  assert.equal(buildApiBaseUrl('192.168.1.20:8081'), 'http://192.168.1.20:3000');
});

test('buildApiBaseUrl falls back to localhost', () => {
  assert.equal(buildApiBaseUrl(undefined), 'http://localhost:3000');
});

test('buildApiBaseUrl ignores extra hostUri segments', () => {
  assert.equal(buildApiBaseUrl('10.0.2.2:8081'), 'http://10.0.2.2:3000');
});
