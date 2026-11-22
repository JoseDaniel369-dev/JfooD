import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  categoryForOff,
  cleanProductName,
  buildSpanishVocabulary,
  looksSpanish,
  looksSpanishEnough,
  offProductToCatalog,
  type OffRow,
} from '../../scripts/catalog/build-off';

function row(overrides: Partial<OffRow> = {}): OffRow {
  return {
    code: '8480000000011',
    product_name: 'Yogur natural',
    brands: 'Hacendado',
    categories_tags: 'en:dairies',
    countries_tags: 'en:spain',
    serving_quantity: '125',
    pnns_groups_1: 'Milk and dairy products',
    pnns_groups_2: 'Milk and yogurt',
    unique_scans_n: '900',
    'energy-kcal_100g': '61',
    energy_100g: '255',
    fat_100g: '3.3',
    carbohydrates_100g: '4.7',
    sugars_100g: '4.7',
    fiber_100g: '0',
    proteins_100g: '3.5',
    salt_100g: '0.1',
    ...overrides,
  };
}

test('a complete, coherent product becomes a catalog food with its barcode, brand and portion', () => {
  const food = offProductToCatalog(row());

  assert.ok(food);
  assert.equal(food.id, 'off-8480000000011');
  assert.equal(food.barcode, '8480000000011');
  assert.equal(food.name, 'Yogur natural');
  assert.equal(food.brand, 'Hacendado');
  assert.equal(food.category, 'Huevos y lácteos');
  assert.equal(food.source, 'open_food_facts');
  assert.equal(food.caloriesKcal, 61);
  assert.equal(food.popularity, 900);
  assert.deepEqual(food.servings, [{ label: '1 ración', grams: 125 }]);
});

test('only products sold in Spain are kept', () => {
  assert.equal(offProductToCatalog(row({ countries_tags: 'en:france' })), null);
  assert.equal(offProductToCatalog(row({ countries_tags: 'en:france,en:spain' }))?.id, 'off-8480000000011');
});

test('a product without calories or macros is dropped, never filled with zeros', () => {
  assert.equal(offProductToCatalog(row({ proteins_100g: '' })), null);
  assert.equal(offProductToCatalog(row({ fat_100g: '' })), null);
  assert.equal(offProductToCatalog(row({ carbohydrates_100g: '' })), null);
  assert.equal(offProductToCatalog(row({ 'energy-kcal_100g': '', energy_100g: '' })), null);
});

test('calories given only in kilojoules are converted', () => {
  const food = offProductToCatalog(row({ 'energy-kcal_100g': '', energy_100g: '255' }));
  assert.equal(food?.caloriesKcal, 61);
});

test('numbers that contradict each other are a typo and the product is dropped', () => {
  // 4·3.5 + 4·4.7 + 9·3.3 ≈ 62 kcal: 600 kcal is not that product.
  assert.equal(offProductToCatalog(row({ 'energy-kcal_100g': '600' })), null);
  // More than 100 g of macros in 100 g.
  assert.equal(offProductToCatalog(row({ proteins_100g: '60', carbohydrates_100g: '50', fat_100g: '10' })), null);
  // Impossible calories.
  assert.equal(offProductToCatalog(row({ 'energy-kcal_100g': '2500', proteins_100g: '90', carbohydrates_100g: '5', fat_100g: '5' })), null);
});

test('a barcode that is not a barcode, or an unknown food group, drops the product', () => {
  assert.equal(offProductToCatalog(row({ code: 'abc' })), null);
  assert.equal(offProductToCatalog(row({ code: '123' })), null);
  assert.equal(offProductToCatalog(row({ pnns_groups_1: 'unknown', pnns_groups_2: 'unknown' })), null);
});

test('sugars above the carbohydrates are discarded, the rest of the product stays', () => {
  const food = offProductToCatalog(row({ sugars_100g: '30' }));
  assert.ok(food);
  assert.equal(food.sugarsGrams, null);
  assert.equal(food.carbohydrateGrams, 4.7);
});

test('names are tidied: size suffixes removed, SHOUTING lowered, blank or junk refused', () => {
  assert.equal(cleanProductName('YOGUR NATURAL 500 g'), 'Yogur natural');
  assert.equal(cleanProductName('Leche entera 1 L'), 'Leche entera');
  assert.equal(cleanProductName('Pan de molde integral'), 'Pan de molde integral');
  assert.equal(cleanProductName('  '), null);
  assert.equal(cleanProductName('12345'), null);
  assert.equal(cleanProductName('visita www.ejemplo.com'), null);
});

test('names in French, German or English are dropped, whatever the countries it is sold in', () => {
  assert.equal(offProductToCatalog(row({ product_name: 'Prince Goût Chocolat au Blé Complet', countries_tags: 'en:france,en:spain' })), null);
  assert.equal(offProductToCatalog(row({ product_name: 'Geröstete Mandel Ohne Zucker', countries_tags: 'en:germany,en:spain' })), null);
  assert.equal(offProductToCatalog(row({ product_name: 'Pure peanut butter with sugar', countries_tags: 'en:spain,en:united-kingdom' })), null);
  assert.ok(offProductToCatalog(row({ product_name: 'Pan integral con semillas', countries_tags: 'en:spain' })));
});

test('Spanish, Catalan-looking and brand-only names pass the language filter', () => {
  for (const name of ['Yogur natural', 'Galletas con chocolate', 'Pan de molde sin corteza', 'Nutella', 'Colines', 'Iogurt natural', 'Atún claro en aceite de oliva']) {
    assert.equal(looksSpanishEnough(name), true, name);
  }
  for (const name of ['Cruesly mélange de noix', 'Fromage au lait', 'Brot mit Zucker', 'Dark chocolate with almonds']) {
    assert.equal(looksSpanishEnough(name), false, name);
  }
});

test('with a Spanish vocabulary, names are judged by how many of their words are Spanish food words', () => {
  const vocabulary = buildSpanishVocabulary([
    'Yogur natural', 'Pan de molde integral', 'Copos de avena', 'Frutos secos', 'Pechuga de pollo', 'Galletas con chocolate',
  ]);
  const spanish = (name: string, brand: string | null = null, onlySpain = false) => looksSpanish(name, brand, onlySpain, vocabulary);

  assert.equal(spanish('Copos de avena'), true);
  assert.equal(spanish('Galletas de avena y chocolate'), true);
  assert.equal(spanish('Nutella'), true, 'a single brand-like word');
  assert.equal(spanish('Coca-Cola', 'Coca-cola services sa/nv'), true, 'a name made of the brand');
  assert.equal(spanish("Flocons d'avoine"), false);
  assert.equal(spanish('Cerneaux de Noix'), false);
  assert.equal(spanish('Strawberry Fruit Yoghurt'), false);
  // Sold only in Spain: a third of known words is enough ("Marbú Dorada" is not French).
  assert.equal(spanish('Zoo Pasta crujiente', null, true), false);
  assert.equal(spanish('Salteado de setas pollo', null, true), true);
});

test('open food facts groups map to the app categories', () => {
  assert.equal(categoryForOff('Beverages', 'Fruit juices'), 'Bebidas');
  assert.equal(categoryForOff('Fish Meat Eggs', 'Eggs'), 'Huevos y lácteos');
  assert.equal(categoryForOff('Fish Meat Eggs', 'Fish and seafood'), 'Pescados y mariscos');
  assert.equal(categoryForOff('Sugary snacks', 'Biscuits and cakes'), 'Dulces y snacks');
  assert.equal(categoryForOff('Cereals and potatoes', 'Legumes'), 'Legumbres');
  assert.equal(categoryForOff('Composite foods', 'Pizza pies and quiche'), 'Platos preparados');
  assert.equal(categoryForOff('Fruits and vegetables', 'unknown'), 'Verduras y hortalizas');
  assert.equal(categoryForOff('unknown', 'unknown'), null);
});
