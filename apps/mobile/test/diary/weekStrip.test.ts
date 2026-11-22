import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildWeekStrip, formatWeekRange } from '../../src/features/diary/utils/weekStrip';

// 2026-11-18 is a Wednesday: its week is Mon 16 → Sun 22 November.
const TODAY = '2026-11-18';

test('the strip always shows Monday to Sunday of the selected week', () => {
  const days = buildWeekStrip('2026-11-18', TODAY, 2000, {});
  assert.deepEqual(days.map((d) => d.date), [
    '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
  ]);
  assert.deepEqual(days.map((d) => d.weekday), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  assert.deepEqual(days.map((d) => d.dayNumber), [16, 17, 18, 19, 20, 21, 22]);
});

test('a Sunday still belongs to the week that started the Monday before', () => {
  const days = buildWeekStrip('2026-11-22', TODAY, 2000, {});
  assert.equal(days[0]?.date, '2026-11-16');
  assert.equal(days[6]?.isSelected, true);
});

test('today, selected and future days are flagged', () => {
  const days = buildWeekStrip('2026-11-17', TODAY, 2000, {});
  assert.deepEqual(days.map((d) => d.isToday), [false, false, true, false, false, false, false]);
  assert.deepEqual(days.map((d) => d.isSelected), [false, true, false, false, false, false, false]);
  assert.deepEqual(days.map((d) => d.isFuture), [false, false, false, true, true, true, true]);
});

test('progress is the share of the calorie goal, capped, and zero when unknown', () => {
  const days = buildWeekStrip('2026-11-18', TODAY, 2000, {
    '2026-11-16': { caloriesKcal: 1000, entries: 3 },
    '2026-11-17': { caloriesKcal: 2600, entries: 5 },
    '2026-11-18': { caloriesKcal: null, entries: 1 },
  });
  assert.equal(days[0]?.progress, 0.5);
  assert.equal(days[1]?.progress, 1, 'over the goal is capped at a full ring');
  assert.equal(days[2]?.progress, 0, 'entries without calories never invent progress');
  assert.equal(days[2]?.logged, true);
  assert.equal(days[3]?.logged, false);
});

test('a missing or zero goal never divides by zero', () => {
  const days = buildWeekStrip('2026-11-18', TODAY, 0, { '2026-11-16': { caloriesKcal: 500, entries: 1 } });
  assert.equal(days[0]?.progress, 0);
});

test('formatWeekRange writes the month once when the week stays inside it', () => {
  assert.equal(formatWeekRange('2026-11-16'), '16 – 22 nov');
  assert.equal(formatWeekRange('2026-10-26'), '26 oct – 1 nov');
  assert.equal(formatWeekRange('2026-12-28'), '28 dic – 3 ene');
});
