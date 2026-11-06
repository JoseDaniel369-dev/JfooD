import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatLocalDate,
  toLocalDate,
} from '../src/features/diary/utils/date';

test('formats the device local calendar date', () => {
  const date = new Date(2026, 0, 2, 0, 30);

  assert.equal(toLocalDate(date), '2026-01-02');
});

test('formats a diary date in Spanish without UTC conversion', () => {
  assert.equal(formatLocalDate('2026-01-02'), 'viernes, 2 de enero');
});
