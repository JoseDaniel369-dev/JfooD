import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SEED_CATALOG } from '../../src/data/seed/seedCatalog';
import { buildFoodCategories, FOOD_CATEGORIES } from '../../src/features/foods/utils/categories';

test('categories keep the catalog order and group every food exactly once', () => {
  const categories = buildFoodCategories([
    { id: 'a', category: 'Frutas' },
    { id: 'b', category: 'Bebidas' },
    { id: 'c', category: 'Frutas' },
  ]);
  assert.deepEqual(categories.map((c) => [c.name, c.ids]), [
    ['Frutas', ['a', 'c']],
    ['Bebidas', ['b']],
  ]);
});

test('every category of the real catalog has an emoji and the ids add up to the whole catalog', () => {
  assert.ok(FOOD_CATEGORIES.length >= 10);
  for (const category of FOOD_CATEGORIES) {
    assert.notEqual(category.emoji, '🍽️', `${category.name} has no emoji of its own`);
    assert.ok(category.ids.length > 0);
  }
  assert.equal(
    FOOD_CATEGORIES.reduce((sum, category) => sum + category.ids.length, 0),
    SEED_CATALOG.length,
  );
});
