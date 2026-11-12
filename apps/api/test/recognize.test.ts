import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '../src/app.js';
import { loadEnvironment } from '../src/config/env.js';

test('recognize returns Gemini result when configured', async (context) => {
  const environment = loadEnvironment({
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-test',
  });
  const app = buildApp({ logger: false, environment });
  context.after(() => app.close());

  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).includes('gemini-test'));
    assert.equal((init as RequestInit).method, 'POST');

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    foods: [
                      {
                        name: 'Manzana',
                        estimatedGrams: 150,
                        confidence: 0.92,
                      },
                    ],
                    warnings: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'data:image/jpeg;base64,abcd' },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.foods.length, 1);
  assert.equal(body.foods[0].name, 'Manzana');
  assert.equal(body.foods[0].estimatedGrams, 150);
  assert.equal(body.foods[0].confidence, 0.92);
  assert.deepEqual(body.warnings, []);
});

test('recognize rejects request when Gemini is not configured', async (context) => {
  const environment = loadEnvironment({});
  const app = buildApp({ logger: false, environment });
  context.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'data:image/jpeg;base64,abcd' },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'GEMINI_NOT_CONFIGURED');
});

test('recognize rejects invalid image payload', async (context) => {
  const environment = loadEnvironment({ GEMINI_API_KEY: 'test-key' });
  const app = buildApp({ logger: false, environment });
  context.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: {},
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'INVALID_IMAGE');
});

test('recognize handles Gemini errors gracefully', async (context) => {
  const environment = loadEnvironment({
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-test',
  });
  const app = buildApp({ logger: false, environment });
  context.after(() => app.close());

  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    return new Response('Internal error', { status: 500 });
  };

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'abcd' },
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, 'RECOGNITION_FAILED');
});

test('recognize handles malformed Gemini JSON gracefully', async (context) => {
  const environment = loadEnvironment({
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-test',
  });
  const app = buildApp({ logger: false, environment });
  context.after(() => app.close());

  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: 'not json' }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'abcd' },
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, 'RECOGNITION_FAILED');
});

test('recognize accepts image payloads larger than 1 MiB', async (context) => {
  const environment = loadEnvironment({
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-test',
  });
  const app = buildApp({ logger: false, environment });
  context.after(() => app.close());

  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    return new Response('Internal error', { status: 500 });
  };

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'x'.repeat(2 * 1024 * 1024) },
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, 'RECOGNITION_FAILED');
});

test('recognize handles Gemini network failures gracefully', async (context) => {
  const environment = loadEnvironment({
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-test',
  });
  const app = buildApp({ logger: false, environment });
  context.after(() => app.close());

  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    throw new Error('Network request failed');
  };

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'abcd' },
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, 'RECOGNITION_FAILED');
});
