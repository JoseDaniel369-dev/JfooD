import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { recognizeImage } from '../../src/features/scanner/api/recognize';

test('recognizeImage returns parsed foods and warnings', async () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        foods: [
          { name: 'Manzana', estimatedGrams: 150, confidence: 0.92 },
          { name: 'Plátano', estimatedGrams: 120, confidence: 0.88 },
        ],
        warnings: ['Las cantidades son aproximadas.'],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const result = await recognizeImage('data:image/jpeg;base64,abcd');

  assert.equal(result.foods.length, 2);
  assert.equal(result.foods[0]?.name, 'Manzana');
  assert.equal(result.foods[0]?.estimatedGrams, 150);
  assert.equal(result.foods[0]?.confidence, 0.92);
  assert.equal(result.warnings[0], 'Las cantidades son aproximadas.');
});

test('recognizeImage throws server error message', async () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 'RECOGNITION_FAILED',
          message: 'Gemini no respondió.',
        },
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  };

  await assert.rejects(
    () => recognizeImage('abcd'),
    /Gemini no respondió/,
  );
});

test('recognizeImage throws on unexpected response shape', async () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ unexpected: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  await assert.rejects(() => recognizeImage('abcd'));
});

test('recognizeImage rejects responses that carry nutritional values', async () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        foods: [{ name: 'Manzana', estimatedGrams: 150, confidence: 0.9, caloriesKcal: 80 }],
        warnings: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  await assert.rejects(() => recognizeImage('abcd'), /Respuesta inesperada/);
});

test('recognizeImage rejects out-of-range grams from the server', async () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        foods: [{ name: 'Manzana', estimatedGrams: -5, confidence: null }],
        warnings: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  await assert.rejects(() => recognizeImage('abcd'), /Respuesta inesperada/);
});

test('recognizeText posts the description to /parse-meal and validates the contract', async () => {
  const { recognizeText } = await import('../../src/features/scanner/api/recognize');
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  let seenUrl = '';
  let seenBody = '';
  globalThis.fetch = async (url, init) => {
    seenUrl = String(url);
    seenBody = String((init as RequestInit).body);
    return new Response(
      JSON.stringify({ foods: [{ name: 'Huevo', estimatedGrams: 120, confidence: 0.8 }], warnings: [] }),
      { status: 200 },
    );
  };

  const result = await recognizeText('2 huevos');
  assert.ok(seenUrl.endsWith('/parse-meal'));
  assert.deepEqual(JSON.parse(seenBody), { text: '2 huevos' });
  assert.equal(result.foods[0]?.name, 'Huevo');

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ foods: [{ name: 'X', estimatedGrams: 1, confidence: 1, fatGrams: 3 }], warnings: [] }), { status: 200 });
  await assert.rejects(() => recognizeText('x'), /Respuesta inesperada/);
});
