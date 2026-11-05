import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '../src/app.js';

test('health endpoint responds without requiring Gemini configuration', async (context) => {
  const app = buildApp({ logger: false });
  context.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    service: 'jfood-api',
    status: 'ok',
  });
});

test('unknown routes use the API error boundary', async (context) => {
  const app = buildApp({ logger: false });
  context.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/missing' });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'NOT_FOUND');
});
