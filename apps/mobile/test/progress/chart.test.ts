import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeChartPoints,
  dayNumber,
  tooltipLeft,
} from '../../src/features/progress/utils/chart';

test('dayNumber counts calendar days across month and DST boundaries', () => {
  assert.equal(dayNumber('2026-03-01') - dayNumber('2026-02-28'), 1);
  assert.equal(dayNumber('2026-10-26') - dayNumber('2026-10-24'), 2);
  assert.equal(dayNumber('2026-12-31') - dayNumber('2026-01-01'), 364);
});

test('chart X positions are proportional to the calendar, not to the log index', () => {
  const points = computeChartPoints(
    [
      { localDate: '2026-11-01', weightKg: 70 },
      { localDate: '2026-11-02', weightKg: 69.5 },
      { localDate: '2026-11-11', weightKg: 68 },
    ],
    100,
    100,
  );

  assert.equal(points[0]?.x, 0);
  assert.equal(points[1]?.x, 10);
  assert.equal(points[2]?.x, 100);
});

test('higher weight is drawn higher (smaller y) and flat series stay inside the plot', () => {
  const [low, high] = computeChartPoints(
    [
      { localDate: '2026-11-01', weightKg: 60 },
      { localDate: '2026-11-02', weightKg: 70 },
    ],
    100,
    100,
  );
  assert.ok(high!.y < low!.y);

  const flat = computeChartPoints([{ localDate: '2026-11-01', weightKg: 70 }], 100, 100);
  assert.equal(flat[0]?.x, 50);
  assert.ok(flat[0]!.y >= 0 && flat[0]!.y <= 100);
  assert.deepEqual(computeChartPoints([], 100, 100), []);
});

test('tooltip stays inside the container', () => {
  assert.equal(tooltipLeft(5, 60, 300), 0);
  assert.equal(tooltipLeft(150, 60, 300), 120);
  assert.equal(tooltipLeft(295, 60, 300), 240);
});
