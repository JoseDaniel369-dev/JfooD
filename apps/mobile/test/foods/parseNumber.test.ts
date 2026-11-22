import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseOptionalNumber, parseSpanishNumber } from '../../src/features/foods/utils/parseNumber';

test('an empty field is unknown, not zero', () => {
  assert.deepEqual(parseOptionalNumber(''), { value: null, valid: true });
  assert.deepEqual(parseOptionalNumber('   '), { value: null, valid: true });
});

test('a zero typed on purpose stays zero', () => {
  assert.deepEqual(parseOptionalNumber('0'), { value: 0, valid: true });
});

test('a decimal comma or point and surrounding spaces are accepted', () => {
  assert.deepEqual(parseOptionalNumber('12,5'), { value: 12.5, valid: true });
  assert.deepEqual(parseOptionalNumber(' 3.25 '), { value: 3.25, valid: true });
});

test('text that is not a number is flagged', () => {
  assert.deepEqual(parseOptionalNumber('abc'), { value: null, valid: false });
  assert.deepEqual(parseOptionalNumber('1,2,3'), { value: null, valid: false });
  assert.deepEqual(parseOptionalNumber('Infinity'), { value: null, valid: false });
});

test('numbers written with exponents, hex or letters are not numbers', () => {
  for (const bad of ['1e3', '0x10', '12g', '--5', '1,2,3', '.', ',']) {
    assert.deepEqual(parseOptionalNumber(bad), { value: null, valid: false }, bad);
  }
});

test('parseSpanishNumber reads a thousands separator only when asked to', () => {
  assert.equal(parseSpanishNumber('1.500', { thousands: true }), 1500);
  assert.equal(parseSpanishNumber('1.500,5', { thousands: true }), 1500.5);
  assert.equal(parseSpanishNumber('12.345.678', { thousands: true }), 12345678);
  // Per 100 g values are small: "2.500" is 2.5, never 2500.
  assert.equal(parseSpanishNumber('2.500'), 2.5);
  // A leading zero is a decimal even when thousands are on.
  assert.equal(parseSpanishNumber('0.500', { thousands: true }), 0.5);
  assert.equal(parseSpanishNumber('1000', { thousands: true }), 1000);
  assert.equal(parseSpanishNumber('-3,5'), -3.5);
  assert.equal(parseSpanishNumber(''), null);
});
