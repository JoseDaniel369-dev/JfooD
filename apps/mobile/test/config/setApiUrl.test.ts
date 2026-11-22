import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyApiUrl, normalizeApiUrl } from '../../scripts/setApiUrl';

const EAS = JSON.stringify({
  build: {
    estable: { distribution: 'internal' },
    experimental: { distribution: 'internal', env: { EXPO_PUBLIC_API_URL: 'https://TU_API.onrender.com' } },
  },
});

test('the API address is normalised to its HTTPS origin', () => {
  assert.equal(normalizeApiUrl(' https://jfood-api.onrender.com/ '), 'https://jfood-api.onrender.com');
  assert.equal(normalizeApiUrl('https://JFood-API.onrender.com'), 'https://jfood-api.onrender.com');
});

test('a bad address is refused with a message that says what to fix', () => {
  assert.throws(() => normalizeApiUrl(''), /Falta la URL/);
  assert.throws(() => normalizeApiUrl('https://TU_API.onrender.com'), /valor de ejemplo/);
  assert.throws(() => normalizeApiUrl('no es una url'), /no es una URL válida/);
  assert.throws(() => normalizeApiUrl('http://api.example.com'), /https/);
  assert.throws(() => normalizeApiUrl('https://api.example.com/recognize'), /sin ruta/);
  assert.throws(() => normalizeApiUrl('https://api.example.com?x=1'), /sin ruta/);
});

test('only the experimental build gets the address; the offline build is untouched', () => {
  const updated = JSON.parse(applyApiUrl(EAS, 'https://jfood-api.onrender.com/')) as {
    build: { estable: { env?: unknown }; experimental: { env: { EXPO_PUBLIC_API_URL: string }; distribution: string } };
  };

  assert.equal(updated.build.experimental.env.EXPO_PUBLIC_API_URL, 'https://jfood-api.onrender.com');
  assert.equal(updated.build.experimental.distribution, 'internal');
  assert.equal(updated.build.estable.env, undefined, 'the offline build must stay without an API');
});

test('a eas.json without the experimental profile is reported', () => {
  assert.throws(() => applyApiUrl('{"build":{"estable":{}}}', 'https://api.example.com'), /experimental/);
});
