import assert from 'node:assert/strict';
import { test } from 'node:test';

import { foodRecognitionSchema, parseRecognitionResponse } from '../src/index.js';

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

test('a tolerant read keeps the good foods and fills in what the model left out', () => {
  const result = parseRecognitionResponse({
    foods: [
      { name: ' Arroz ', estimatedGrams: 150 }, // no confidence
      { name: 'Aceite', estimatedGrams: 0, confidence: 0.5 }, // unusable weight
      { name: 'Pan', estimatedGrams: 40, confidence: 0.9, unit: 'rebanada' }, // harmless extra key
    ],
  });

  assert.deepEqual(result, {
    foods: [
      { name: 'Arroz', estimatedGrams: 150, confidence: null },
      { name: 'Pan', estimatedGrams: 40, confidence: 0.9 },
    ],
    warnings: ['Algunos alimentos no se han podido interpretar.'],
  });
  // Whatever it returns also satisfies the strict contract the app checks.
  foodRecognitionSchema.parse(result);
});

test('a tolerant read still refuses any nutrition from the model', () => {
  for (const nutrientKey of ['caloriesKcal', 'protein', 'carbs', 'fatGrams', 'calorías']) {
    assert.equal(
      parseRecognitionResponse({
        foods: [{ name: 'Pollo', estimatedGrams: 120, confidence: 0.8, [nutrientKey]: 200 }],
        warnings: [],
      }),
      null,
      nutrientKey,
    );
  }
  assert.equal(parseRecognitionResponse({ foods: [], calories: 1 }), null);
  assert.equal(parseRecognitionResponse({ foods: 'x' }), null);
  assert.equal(parseRecognitionResponse(null), null);
});
