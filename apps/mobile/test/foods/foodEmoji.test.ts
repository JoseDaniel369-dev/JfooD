import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_FOOD_EMOJI, foodEmoji } from '../../src/features/foods/utils/foodEmoji';

test('common foods get their emoji, ignoring case and accents', () => {
  assert.equal(foodEmoji('Manzana golden'), '🍎');
  assert.equal(foodEmoji('PLÁTANO'), '🍌');
  assert.equal(foodEmoji('Pechuga de pollo'), '🍗');
  assert.equal(foodEmoji('Arroz integral'), '🍚');
  assert.equal(foodEmoji('Huevo cocido'), '🥚');
  assert.equal(foodEmoji('Salmón al horno'), '🐟');
  assert.equal(foodEmoji('Pan integral'), '🍞');
});

test('specific phrases win over generic ones', () => {
  assert.equal(foodEmoji('Leche de almendra'), '🥛');
  assert.equal(foodEmoji('Patatas fritas'), '🍟');
  assert.equal(foodEmoji('Patata cocida'), '🥔');
  assert.equal(foodEmoji('Aceite de oliva'), '🫒');
  assert.equal(foodEmoji('Mantequilla de cacahuete'), '🥜');
  assert.equal(foodEmoji('Judía verde'), '🫛');
});

test('a keyword only matches at the start of a word', () => {
  assert.equal(foodEmoji('Aguacate'), '🥑');
  assert.equal(foodEmoji('Agua mineral'), '💧');
  assert.equal(foodEmoji('Panceta'), '🥓');
  assert.equal(foodEmoji('Campana de cocina'), DEFAULT_FOOD_EMOJI);
  assert.equal(foodEmoji('Té verde'), '🍵');
  assert.equal(foodEmoji('Ternera'), '🥩');
});

test('unknown or empty names fall back to a plate', () => {
  assert.equal(foodEmoji('Zzz raro'), DEFAULT_FOOD_EMOJI);
  assert.equal(foodEmoji(''), DEFAULT_FOOD_EMOJI);
  assert.equal(foodEmoji('   '), DEFAULT_FOOD_EMOJI);
});
