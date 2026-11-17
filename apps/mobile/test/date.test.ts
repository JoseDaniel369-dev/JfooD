import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  assertLocalDate,
  formatLocalDate,
  isValidLocalDate,
  toLocalDate,
} from '../src/features/diary/utils/date';

test('formats the device local calendar date', () => {
  const date = new Date(2026, 0, 2, 0, 30);

  assert.equal(toLocalDate(date), '2026-01-02');
});

test('formats a diary date in Spanish without UTC conversion', () => {
  assert.equal(formatLocalDate('2026-01-02'), 'viernes, 2 de enero');
});

test('addDays moves to the next day', () => {
  assert.equal(addDays('2026-01-02', 1), '2026-01-03');
});

test('addDays moves to the previous day', () => {
  assert.equal(addDays('2026-01-02', -1), '2026-01-01');
});

test('addDays crosses month boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('isValidLocalDate accepts real dates and rejects malformed or impossible ones', () => {
  assert.equal(isValidLocalDate('2026-11-17'), true);
  assert.equal(isValidLocalDate('2028-02-29'), true);
  assert.equal(isValidLocalDate('2026-02-29'), false);
  assert.equal(isValidLocalDate('2026-02-31'), false);
  assert.equal(isValidLocalDate('garbage'), false);
  assert.equal(isValidLocalDate('2026-1-5'), false);
  assert.equal(isValidLocalDate(''), false);
});

test('assertLocalDate throws a Spanish message for invalid dates', () => {
  assert.equal(assertLocalDate('2026-11-17'), '2026-11-17');
  assert.throws(() => assertLocalDate('garbage'), /fecha no es válida/);
});
