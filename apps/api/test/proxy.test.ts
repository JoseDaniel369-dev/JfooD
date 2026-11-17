import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '../src/app.js';
import { resolveTrustProxyHops, loadEnvironment } from '../src/config/env.js';

const environment = loadEnvironment({ GEMINI_API_KEY: 'test-key' });
const newApp = (trustProxyHops?: number) =>
  buildApp({ logger: false, environment, trustProxyHops });

async function hit(app: ReturnType<typeof buildApp>, forwardedFor: string, remoteAddress = '10.0.0.1') {
  const response = await app.inject({
    method: 'POST',
    url: '/recognize',
    payload: {},
    remoteAddress,
    headers: { 'x-forwarded-for': forwardedFor },
  });
  return response.statusCode;
}

test('behind one trusted proxy each real client IP gets its own rate-limit bucket', async (context) => {
  const app = newApp(1);
  context.after(() => app.close());

  for (let i = 0; i < 10; i += 1) {
    assert.equal(await hit(app, '1.1.1.1'), 400);
  }
  assert.equal(await hit(app, '1.1.1.1'), 429);
  // A different client behind the same proxy is not affected.
  assert.equal(await hit(app, '2.2.2.2'), 400);
});

test('a forged X-Forwarded-For prefix cannot reset the rate limit', async (context) => {
  const app = newApp(1);
  context.after(() => app.close());

  for (let i = 0; i < 10; i += 1) {
    assert.equal(await hit(app, `fake-${i}, 3.3.3.3`), 400);
  }
  // The proxy-appended address (3.3.3.3) is what counts, whatever the client sent.
  assert.equal(await hit(app, 'another-fake, 3.3.3.3'), 429);
});

test('without a trusted proxy the header is ignored and the socket IP is used', async (context) => {
  const app = newApp();
  context.after(() => app.close());

  for (let i = 0; i < 10; i += 1) {
    assert.equal(await hit(app, `9.9.9.${i}`), 400);
  }
  assert.equal(await hit(app, '8.8.8.8'), 429);
});

test('trust proxy hops default to 1 on Render and 0 elsewhere, and can be overridden', () => {
  assert.equal(resolveTrustProxyHops(loadEnvironment({})), 0);
  assert.equal(resolveTrustProxyHops(loadEnvironment({ RENDER: 'true' })), 1);
  assert.equal(resolveTrustProxyHops(loadEnvironment({ RENDER: 'true', TRUST_PROXY_HOPS: '2' })), 2);
  assert.equal(resolveTrustProxyHops(loadEnvironment({ TRUST_PROXY_HOPS: '0', RENDER: 'true' })), 0);
});

test('/recognize is rate limited (regression: routes were registered before the limiter loaded)', async (context) => {
  const app = newApp();
  context.after(() => app.close());

  const codes: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    codes.push(await hit(app, '5.5.5.5'));
  }
  assert.deepEqual(codes.slice(0, 10), Array(10).fill(400));
  assert.deepEqual(codes.slice(10), [429, 429]);
});

test('/health is never rate limited so uptime monitors keep working', async (context) => {
  const app = newApp();
  context.after(() => app.close());

  for (let i = 0; i < 25; i += 1) {
    const response = await app.inject({ method: 'GET', url: '/health?x=1' });
    assert.equal(response.statusCode, 200);
  }
});
