import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describeGramsError,
  parseGrams,
  removeMatch,
  setMatchGrams,
} from '../../src/features/scanner/utils/matches';
import type { RecognizedFoodMatch } from '../../src/features/scanner/types';

function match(id: string, grams: number): RecognizedFoodMatch {
  return {
    id,
    recognized: { name: id, estimatedGrams: grams, confidence: null },
    food: null,
    grams,
    confidence: null,
  };
}

test('removing a result keeps each other result with its own grams', () => {
  const rest = removeMatch([match('a', 10), match('b', 20), match('c', 30)], 'b');
  assert.deepEqual(
    rest.map((item) => [item.id, item.grams]),
    [
      ['a', 10],
      ['c', 30],
    ],
  );
});

test('setMatchGrams only changes the row with that id', () => {
  const next = setMatchGrams([match('a', 10), match('b', 20)], 'b', 55);
  assert.deepEqual(
    next.map((item) => item.grams),
    [10, 55],
  );
});

test('parseGrams accepts a comma and rejects empty, zero and huge amounts', () => {
  assert.equal(parseGrams('12,5'), 12.5);
  assert.equal(parseGrams(''), null);
  assert.equal(parseGrams('0'), null);
  assert.equal(parseGrams('abc'), null);
  assert.equal(parseGrams('100001'), null);
  assert.equal(parseGrams('100000'), 100000);
});

test('describeGramsError explains why an amount is not valid', () => {
  assert.equal(describeGramsError('150'), null);
  assert.match(describeGramsError('') ?? '', /gramos/);
  assert.match(describeGramsError('-3') ?? '', /mayor que 0/);
  assert.match(describeGramsError('200000') ?? '', /100\.000/);
});
