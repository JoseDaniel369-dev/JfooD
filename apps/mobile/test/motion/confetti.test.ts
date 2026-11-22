import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConfettiPieces, seededRandom } from '../../src/features/motion/confettiPieces';

test('the same seed always gives the same shower, a different seed another one', () => {
  assert.deepEqual(buildConfettiPieces(20, 5, 7), buildConfettiPieces(20, 5, 7));
  assert.notDeepEqual(buildConfettiPieces(20, 5, 7), buildConfettiPieces(20, 5, 8));
});

test('every piece stays inside sensible bounds and uses a palette colour', () => {
  const pieces = buildConfettiPieces(200, 5, 3);
  assert.equal(pieces.length, 200);
  for (const piece of pieces) {
    assert.ok(piece.x >= 0 && piece.x < 1);
    assert.ok(Math.abs(piece.drift) <= 70);
    assert.ok(piece.delay >= 0 && piece.delay <= 450);
    assert.ok(piece.duration >= 1500 && piece.duration <= 2600);
    assert.ok(piece.size >= 6 && piece.size <= 12);
    assert.ok(Number.isInteger(piece.color) && piece.color >= 0 && piece.color < 5);
  }
});

test('an empty palette or zero pieces never breaks', () => {
  assert.deepEqual(buildConfettiPieces(0, 5), []);
  assert.equal(buildConfettiPieces(3, 0)[0]?.color, 0);
});

test('seededRandom is uniform enough and stays in [0, 1)', () => {
  const random = seededRandom(42);
  let sum = 0;
  for (let i = 0; i < 1000; i += 1) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
    sum += value;
  }
  assert.ok(Math.abs(sum / 1000 - 0.5) < 0.05);
});
