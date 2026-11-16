import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeStreak,
  computeWeekStats,
} from '@/features/stats/utils/streak';

test('computeStreak returns zero when there are no logged dates', () => {
  const result = computeStreak([], '2026-11-14');
  assert.equal(result.current, 0);
  assert.equal(result.best, 0);
  assert.equal(result.totalDays, 0);
});

test('computeStreak counts current streak including today', () => {
  const dates = ['2026-11-12', '2026-11-13', '2026-11-14'];
  const result = computeStreak(dates, '2026-11-14');
  assert.equal(result.current, 3);
  assert.equal(result.best, 3);
});

test('computeStreak keeps streak alive if yesterday was logged but not today', () => {
  const dates = ['2026-11-12', '2026-11-13'];
  const result = computeStreak(dates, '2026-11-14');
  assert.equal(result.current, 2);
});

test('computeStreak breaks streak when a day is missed', () => {
  const dates = ['2026-11-10', '2026-11-11', '2026-11-13'];
  const result = computeStreak(dates, '2026-11-14');
  assert.equal(result.current, 1);
  assert.equal(result.best, 2);
});

test('computeWeekStats returns average and logged days', () => {
  const records = [
    { localDate: '2026-11-08', caloriesKcal: 2000 },
    { localDate: '2026-11-09', caloriesKcal: 2200 },
    { localDate: '2026-11-11', caloriesKcal: 2100 },
  ];
  const result = computeWeekStats(records, '2026-11-14');
  assert.equal(result.days.length, 7);
  assert.equal(result.loggedDays, 3);
  assert.equal(result.averageKcal, 2100);
});

test('computeWeekStats handles empty week', () => {
  const result = computeWeekStats([], '2026-11-14');
  assert.equal(result.days.length, 7);
  assert.equal(result.loggedDays, 0);
  assert.equal(result.averageKcal, null);
});
