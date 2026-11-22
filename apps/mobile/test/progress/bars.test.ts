import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBars } from '../../src/features/progress/utils/bars';

test('the highest value fills the chart and the others are proportional', () => {
  const { bars, maximum } = buildBars([{ value: 1000 }, { value: 2000 }], null, 100, 100, 0);
  assert.equal(maximum, 2000);
  assert.equal(bars[1]?.height, 100);
  assert.equal(bars[1]?.y, 0);
  assert.equal(bars[0]?.height, 50);
  assert.equal(bars[0]?.y, 50);
});

test('the goal line is always inside the chart, even above every bar', () => {
  const layout = buildBars([{ value: 500 }], 2000, 100, 100);
  assert.equal(layout.maximum, 2000);
  assert.equal(layout.goalY, 0);
  assert.equal(layout.bars[0]?.height, 25);

  const middle = buildBars([{ value: 4000 }], 2000, 100, 100);
  assert.equal(middle.goalY, 50);
});

test('days without data get a thin stub, and tiny values stay visible', () => {
  const { bars } = buildBars([{ value: null }, { value: 1 }, { value: 2000 }], null, 90, 100, 0);
  assert.equal(bars[0]?.kind, 'empty');
  assert.equal(bars[0]?.height, 3);
  assert.equal(bars[1]?.height, 6, 'never thinner than the minimum');
  assert.equal(bars[2]?.height, 100);
});

test('approximate bars are marked so they can be drawn differently', () => {
  const { bars } = buildBars([{ value: 900, approximate: true }, { value: 900 }], null, 100, 100);
  assert.deepEqual(bars.map((bar) => bar.kind), ['approximate', 'normal']);
});

test('bars fill the width: widths and gaps add up exactly', () => {
  const { bars } = buildBars(Array.from({ length: 10 }, () => ({ value: 5 })), null, 200, 50, 4);
  const last = bars[bars.length - 1]!;
  assert.ok(Math.abs(last.x + last.width - 200) < 1e-9);
  assert.ok(Math.abs(bars[1]!.x - (bars[0]!.x + bars[0]!.width + 4)) < 1e-9);
});

test('nothing to draw gives an empty layout instead of NaN', () => {
  assert.deepEqual(buildBars([], 2000, 100, 100), { bars: [], goalY: null, maximum: 0 });
  assert.deepEqual(buildBars([{ value: 5 }], null, 0, 100), { bars: [], goalY: null, maximum: 0 });
  const zeros = buildBars([{ value: 0 }], null, 50, 50);
  assert.equal(Number.isFinite(zeros.bars[0]!.y), true);
});
