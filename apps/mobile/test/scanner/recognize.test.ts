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
  assert.equal(result.foods[0].name, 'Manzana');
  assert.equal(result.foods[0].estimatedGrams, 150);
  assert.equal(result.foods[0].confidence, 0.92);
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
