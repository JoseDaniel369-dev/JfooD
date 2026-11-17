import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '../src/app.js';
import { loadEnvironment } from '../src/config/env.js';
import { createDailyLimiter } from '../src/features/recognition/dailyLimit.js';

const GEMINI_OK = JSON.stringify({
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              foods: [{ name: 'Manzana', estimatedGrams: 150, confidence: 0.9 }],
              warnings: [],
            }),
          },
        ],
      },
    },
  ],
});

function mockFetch(context: { after: (fn: () => void) => void }, handler: typeof fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  context.after(() => {
    globalThis.fetch = original;
  });
}

test('the Gemini key is sent in a header and never appears in the URL', async (context) => {
  const app = buildApp({
    logger: false,
    environment: loadEnvironment({ GEMINI_API_KEY: 'secret-key', GEMINI_MODEL: 'gemini-test' }),
  });
  context.after(() => app.close());

  let seenUrl = '';
  let seenHeaders: Record<string, string> = {};
  mockFetch(context, async (url, init) => {
    seenUrl = String(url);
    seenHeaders = (init as RequestInit).headers as Record<string, string>;
    return new Response(GEMINI_OK, { status: 200 });
  });

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'data:image/jpeg;base64,abcd' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(seenHeaders['x-goog-api-key'], 'secret-key');
  assert.equal(seenUrl.includes('secret-key'), false);
  assert.equal(seenUrl.includes('key='), false);
  assert.ok(seenUrl.includes('gemini-test:generateContent'));
});

test('invalid image payloads are rejected before reaching Gemini', async (context) => {
  const app = buildApp({
    logger: false,
    environment: loadEnvironment({ GEMINI_API_KEY: 'k' }),
  });
  context.after(() => app.close());

  let calls = 0;
  mockFetch(context, async () => {
    calls += 1;
    return new Response(GEMINI_OK, { status: 200 });
  });

  const invalid: unknown[] = [
    {},
    { image: 42 },
    { image: '' },
    { image: 'data:text/html;base64,PGh0bWw+' },
    { image: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { image: 'not base64 !!!' },
    { image: `data:image/png;base64,${'A'.repeat(8_000_001)}` },
  ];

  for (const payload of invalid) {
    const response = await app.inject({ method: 'POST', url: '/recognize', payload: payload as object });
    assert.equal(response.statusCode, 400, JSON.stringify(payload).slice(0, 60));
    assert.equal(response.json().error.code, 'INVALID_IMAGE');
  }
  assert.equal(calls, 0);
});

test('png, webp and raw base64 images are accepted', async (context) => {
  const app = buildApp({
    logger: false,
    environment: loadEnvironment({ GEMINI_API_KEY: 'k' }),
  });
  context.after(() => app.close());
  mockFetch(context, async () => new Response(GEMINI_OK, { status: 200 }));

  for (const image of ['data:image/png;base64,abcd', 'data:image/webp;base64,abcd', 'abcd']) {
    const response = await app.inject({ method: 'POST', url: '/recognize', payload: { image } });
    assert.equal(response.statusCode, 200, image);
  }
});

test('the daily budget stops calls to Gemini and does not count rejected requests', async (context) => {
  const app = buildApp({
    logger: false,
    environment: loadEnvironment({ GEMINI_API_KEY: 'k', RECOGNIZE_DAILY_LIMIT: '2' }),
  });
  context.after(() => app.close());

  let calls = 0;
  mockFetch(context, async () => {
    calls += 1;
    return new Response(GEMINI_OK, { status: 200 });
  });

  // An invalid request does not consume budget.
  await app.inject({ method: 'POST', url: '/recognize', payload: {} });

  const codes: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/recognize',
      payload: { image: 'data:image/jpeg;base64,abcd' },
    });
    codes.push(response.statusCode);
    if (response.statusCode === 429) {
      assert.equal(response.json().error.code, 'DAILY_LIMIT_REACHED');
    }
  }

  assert.deepEqual(codes, [200, 200, 429]);
  assert.equal(calls, 2);
});

test('createDailyLimiter resets at UTC midnight', () => {
  let now = new Date('2026-11-17T23:59:00Z');
  const limiter = createDailyLimiter(1, () => now);

  assert.equal(limiter.tryConsume(), true);
  assert.equal(limiter.tryConsume(), false);
  assert.equal(limiter.remaining(), 0);

  now = new Date('2026-11-18T00:00:01Z');
  assert.equal(limiter.remaining(), 1);
  assert.equal(limiter.tryConsume(), true);
});

test('answers split into several parts, including thought parts, are still parsed', async (context) => {
  const app = buildApp({ logger: false, environment: loadEnvironment({ GEMINI_API_KEY: 'k' }) });
  context.after(() => app.close());

  const answer = JSON.stringify({
    foods: [{ name: 'Pan', estimatedGrams: 60, confidence: 0.8 }],
    warnings: [],
  });
  mockFetch(context, async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { text: 'razonamiento interno', thought: true },
                { text: answer.slice(0, 20) },
                { text: answer.slice(20) },
              ],
            },
          },
        ],
      }),
      { status: 200 },
    ),
  );

  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: { image: 'data:image/jpeg;base64,abcd' },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().foods[0].name, 'Pan');
});
