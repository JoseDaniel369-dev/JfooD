import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectFoodMatch } from '../../src/features/scanner/utils/matchFood';
import type { Food } from '../../src/features/foods/types';

function makeFood(name: string): Food {
  return {
    id: `id-${name}`,
    name,
    normalizedName: name,
    brand: null,
    barcode: null,
    source: 'user',
    externalId: null,
    caloriesKcal: 100,
    proteinGrams: 1,
    carbohydrateGrams: 2,
    fatGrams: 3,
    fiberGrams: null,
    sugarsGrams: null,
    saltGrams: null,
    isFavorite: false,
    cachedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test('selectFoodMatch returns exact match', () => {
  const foods = [makeFood('manzana golden'), makeFood('manzana'), makeFood('platano')];
  const match = selectFoodMatch(foods, 'manzana');
  assert.equal(match?.name, 'manzana');
});

test('selectFoodMatch returns prefix match when no exact match', () => {
  const foods = [makeFood('manzana golden'), makeFood('platano')];
  const match = selectFoodMatch(foods, 'manzana');
  assert.equal(match?.name, 'manzana golden');
});

test('selectFoodMatch rejects partial containment without prefix', () => {
  const foods = [makeFood('zumo de manzana'), makeFood('tarta de manzana')];
  const match = selectFoodMatch(foods, 'manzana');
  assert.equal(match, null);
});

test('selectFoodMatch rejects similar words', () => {
  const foods = [makeFood('manzanilla')];
  const match = selectFoodMatch(foods, 'manzana');
  assert.equal(match, null);
});

test('selectFoodMatch returns null for empty recognized name', () => {
  const foods = [makeFood('manzana')];
  const match = selectFoodMatch(foods, '   ');
  assert.equal(match, null);
});

test('selectFoodMatch returns null when catalog is empty', () => {
  const match = selectFoodMatch([], 'manzana');
  assert.equal(match, null);
});
