import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitWithin } from '../../src/features/scanner/utils/resize';

test('large photos are scaled down keeping the aspect ratio', () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 1024, height: 768 });
  assert.deepEqual(fitWithin(3000, 4000), { width: 768, height: 1024 });
});

test('small photos are never enlarged and bad sizes are ignored', () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.equal(fitWithin(0, 600), null);
  assert.equal(fitWithin(Number.NaN, 600), null);
});
