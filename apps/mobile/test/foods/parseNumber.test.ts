import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseOptionalNumber } from '../../src/features/foods/utils/parseNumber';

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
