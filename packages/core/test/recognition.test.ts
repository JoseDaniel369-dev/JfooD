import assert from 'node:assert/strict';
import { test } from 'node:test';

import { foodRecognitionSchema } from '../src/index.js';

test('accepts identified foods with estimated portions', () => {
  const result = foodRecognitionSchema.parse({
    foods: [
      { name: 'Arroz cocido', estimatedGrams: 180, confidence: 0.7 },
      { name: 'Pollo', estimatedGrams: 120, confidence: null },
    ],
    warnings: ['Las cantidades son aproximadas.'],
  });

  assert.equal(result.foods.length, 2);
  assert.equal(result.foods[0]?.estimatedGrams, 180);
});

test('rejects nutritional values supplied by the recognition model', () => {
  assert.throws(() =>
    foodRecognitionSchema.parse({
      foods: [
        {
          name: 'Pollo',
          estimatedGrams: 120,
          confidence: 0.8,
          caloriesKcal: 200,
        },
      ],
      warnings: [],
    }),
  );
});

test('accepts an empty recognition with warnings for manual recovery', () => {
  const result = foodRecognitionSchema.parse({
    foods: [],
    warnings: ['No se han podido identificar alimentos.'],
  });

  assert.deepEqual(result.foods, []);
});
