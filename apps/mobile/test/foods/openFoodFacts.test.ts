import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeNutrients } from '@jfood/core';

import {
  fetchProduct,
  mapOpenFoodFactsProduct,
  normalizeBarcode,
} from '../../src/features/foods/utils/openFoodFacts';

const nutella = {
  status: 1,
  product: {
    product_name: 'Crema de cacao',
    brands: 'Marca Uno, Marca Dos',
    nutriments: {
      'energy-kcal_100g': 539,
      proteins_100g: 6.3,
      carbohydrates_100g: '57,5',
      fat_100g: 30.9,
    },
  },
};

test('normalizeBarcode accepts common retail codes and rejects the rest', () => {
  assert.equal(normalizeBarcode('8410000123456'), '8410000123456');
  assert.equal(normalizeBarcode(' 8410 0001 2345 6 '), '8410000123456');
  assert.equal(normalizeBarcode('12345670'), '12345670');
  assert.equal(normalizeBarcode('123456'), null);
  assert.equal(normalizeBarcode('https://example.com'), null);
});

test('a complete product is mapped with per-100 g values', () => {
  const product = mapOpenFoodFactsProduct(nutella, '8410000123456');
  assert.deepEqual(product, {
    barcode: '8410000123456',
    name: 'Crema de cacao',
    brand: 'Marca Uno',
    per100g: makeNutrients({ caloriesKcal: 539, proteinGrams: 6.3, carbohydrateGrams: 57.5, fatGrams: 30.9 }),
    incomplete: false,
  });
});

test('missing or implausible nutrients stay unknown instead of becoming zero', () => {
  const partial = mapOpenFoodFactsProduct(
    { status: 1, product: { product_name: 'Sin datos', nutriments: { proteins_100g: 4 } } },
    '8410000123456',
  );
  assert.equal(partial?.per100g.caloriesKcal, null);
  assert.equal(partial?.per100g.proteinGrams, 4);
  assert.equal(partial?.incomplete, true);

  const absurd = mapOpenFoodFactsProduct(
    { status: 1, product: { product_name: 'Raro', nutriments: { 'energy-kcal_100g': 99999, fat_100g: 500 } } },
    '8410000123456',
  );
  assert.deepEqual(absurd?.per100g, makeNutrients());
});

test('calories are derived from kilojoules when kcal is absent', () => {
  const product = mapOpenFoodFactsProduct(
    { status: 1, product: { product_name: 'X', nutriments: { energy_100g: 1000 } } },
    '8410000123456',
  );
  assert.equal(product?.per100g.caloriesKcal, 239);
});

test('unknown products and malformed responses map to null', () => {
  assert.equal(mapOpenFoodFactsProduct({ status: 0 }, '8410000123456'), null);
  assert.equal(mapOpenFoodFactsProduct({ status: 1, product: {} }, '8410000123456'), null);
  assert.equal(mapOpenFoodFactsProduct('nope', '8410000123456'), null);
  assert.equal(mapOpenFoodFactsProduct(null, '8410000123456'), null);
});

test('fetchProduct handles found, missing and failing services', async () => {
  const ok = async () => new Response(JSON.stringify(nutella), { status: 200 });
  assert.equal((await fetchProduct('8410000123456', ok as typeof fetch))?.name, 'Crema de cacao');

  const missing = async () => new Response('{}', { status: 404 });
  assert.equal(await fetchProduct('8410000123456', missing as typeof fetch), null);

  const down = async () => new Response('', { status: 503 });
  await assert.rejects(() => fetchProduct('8410000123456', down as typeof fetch), /no responde/);
});

test('one implausible value does not discard the plausible ones', () => {
  const product = mapOpenFoodFactsProduct(
    {
      status: 1,
      product: {
        product_name: 'Datos mezclados',
        nutriments: {
          'energy-kcal_100g': 320,
          proteins_100g: 12,
          carbohydrates_100g: 60,
          fat_100g: 500,
        },
      },
    },
    '8410000123456',
  );
  assert.deepEqual(
    product?.per100g,
    makeNutrients({ caloriesKcal: 320, proteinGrams: 12, carbohydrateGrams: 60 }),
  );
  assert.equal(product?.incomplete, true);
});

test('macros that add up to more than 100 g are dropped but calories stay', () => {
  const product = mapOpenFoodFactsProduct(
    {
      status: 1,
      product: {
        product_name: 'Suma imposible',
        nutriments: {
          'energy-kcal_100g': 400,
          proteins_100g: 40,
          carbohydrates_100g: 50,
          fat_100g: 30,
        },
      },
    },
    '8410000123456',
  );
  assert.deepEqual(product?.per100g, makeNutrients({ caloriesKcal: 400 }));
});

test('a UPC-A code is stored as its EAN-13 form so both readers find the same food', () => {
  assert.equal(normalizeBarcode('036000291452'), '0036000291452');
  assert.equal(normalizeBarcode('0036000291452'), '0036000291452');
  assert.equal(normalizeBarcode('1234567'), null);
});
