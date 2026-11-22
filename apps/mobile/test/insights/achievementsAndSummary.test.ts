import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AchievementStats, DailyTotals } from '../../src/data/sqlite/repositories/summaryRepository';
import {
  countWeighedWeeks,
  detectNewAchievements,
  evaluateAchievements,
  parseSeenIds,
} from '../../src/features/achievements/achievements';
import { buildWeekSummary, type WeekSummaryInput } from '../../src/features/insights/buildWeekSummary';

// ---- Achievements ----------------------------------------------------------

const EMPTY: AchievementStats = {
  totalEntries: 0,
  loggedDates: [],
  daysWithAllMeals: 0,
  distinctFoods: 0,
  recipes: 0,
  weightDates: [],
};

const TODAY = '2026-11-18';

function byId(list: ReturnType<typeof evaluateAchievements>, id: string) {
  const found = list.find((item) => item.id === id);
  assert.ok(found, `missing achievement ${id}`);
  return found;
}

test('a brand new person has every achievement locked with zero progress', () => {
  const list = evaluateAchievements(EMPTY, TODAY, 0);
  assert.ok(list.length >= 10);
  assert.equal(list.every((a) => !a.unlocked && a.progress === 0), true);
  assert.equal(new Set(list.map((a) => a.id)).size, list.length, 'ids are unique');
});

test('the first entry unlocks "Primer paso" and starts the streak badges', () => {
  const list = evaluateAchievements({ ...EMPTY, totalEntries: 1, loggedDates: ['2026-11-18'] }, TODAY, 0);
  assert.equal(byId(list, 'first-entry').unlocked, true);
  assert.equal(byId(list, 'streak-3').unlocked, false);
  assert.ok(Math.abs(byId(list, 'streak-3').progress - 1 / 3) < 1e-9);
});

test('streak badges use the BEST run ever, so breaking a streak never takes a badge away', () => {
  const week = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
  const list = evaluateAchievements({ ...EMPTY, totalEntries: 7, loggedDates: [...week, '2026-11-18'] }, TODAY, 0);
  assert.equal(byId(list, 'streak-7').unlocked, true);
  assert.equal(byId(list, 'streak-30').unlocked, false);
});

test('progress is capped at 100 % and counts what the history holds', () => {
  const list = evaluateAchievements(
    { ...EMPTY, totalEntries: 250, distinctFoods: 31, recipes: 2, daysWithAllMeals: 3 },
    TODAY,
    9,
  );
  assert.equal(byId(list, 'entries-100').progress, 1);
  assert.equal(byId(list, 'entries-100').current, 250);
  assert.equal(byId(list, 'variety-30').unlocked, true);
  assert.equal(byId(list, 'first-recipe').unlocked, true);
  assert.equal(byId(list, 'all-meals').unlocked, true);
  assert.equal(byId(list, 'water-7').unlocked, true);
});

test('weighing counts different calendar weeks, not different days', () => {
  assert.equal(countWeighedWeeks(['2026-11-16', '2026-11-17', '2026-11-22']), 1);
  assert.equal(countWeighedWeeks(['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']), 4);
  assert.equal(countWeighedWeeks([]), 0);
  const list = evaluateAchievements({ ...EMPTY, weightDates: ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-18'] }, TODAY, 0);
  assert.equal(byId(list, 'weigh-4').current, 3);
});

test('only unlocked achievements not seen before are reported as new', () => {
  const list = evaluateAchievements({ ...EMPTY, totalEntries: 120 }, TODAY, 0);

  assert.deepEqual(
    detectNewAchievements(list, []).map((a) => a.id).sort(),
    ['entries-100', 'first-entry'],
  );
  assert.deepEqual(detectNewAchievements(list, ['first-entry']).map((a) => a.id), ['entries-100']);
  assert.deepEqual(detectNewAchievements(list, ['first-entry', 'entries-100']), []);
});

test('the stored list of seen ids tolerates anything unexpected', () => {
  assert.deepEqual(parseSeenIds('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseSeenIds(null), []);
  assert.deepEqual(parseSeenIds('not json'), []);
  assert.deepEqual(parseSeenIds('{"a":1}'), []);
  assert.deepEqual(parseSeenIds('["a",3,null,"b"]'), ['a', 'b']);
});

// ---- Week summary ----------------------------------------------------------

function day(localDate: string, overrides: Partial<DailyTotals> = {}): DailyTotals {
  return {
    localDate,
    entries: 3,
    caloriesKcal: 2000,
    proteinGrams: 100,
    carbohydrateGrams: 250,
    fatGrams: 70,
    fiberGrams: 25,
    caloriesPartial: false,
    ...overrides,
  };
}

function summary(overrides: Partial<WeekSummaryInput> = {}) {
  return buildWeekSummary({
    days: [],
    previousDays: [],
    goalKcal: 2000,
    waterTotals: {},
    waterGoalMl: 2000,
    weights: [],
    ...overrides,
  });
}

test('an empty week summarises to nothing, without dividing by zero', () => {
  const result = summary();
  assert.equal(result.loggedDays, 0);
  assert.equal(result.averageKcal, null);
  assert.equal(result.macroSplit, null);
  assert.equal(result.kcalChangeVsPrevious, null);
  assert.equal(result.averageWaterMl, null);
  assert.equal(result.weightChangeKg, null);
  assert.equal(result.closestToGoal, null);
});

test('average, days on target, closest and highest day', () => {
  const result = summary({
    days: [
      day('2026-11-16', { caloriesKcal: 1900 }),
      day('2026-11-17', { caloriesKcal: 2600 }),
      day('2026-11-18', { caloriesKcal: 2050 }),
    ],
  });
  assert.equal(result.loggedDays, 3);
  assert.equal(result.averageKcal, 2183);
  assert.equal(result.daysOnTarget, 2, '1900 and 2050 are within 10 % of 2000');
  assert.equal(result.comparableDays, 3);
  assert.deepEqual(result.closestToGoal, { localDate: '2026-11-18', caloriesKcal: 2050 });
  assert.deepEqual(result.highestDay, { localDate: '2026-11-17', caloriesKcal: 2600 });
});

test('a day with a food without calories is never compared, so it cannot look better than it was', () => {
  const result = summary({
    days: [
      day('2026-11-16', { caloriesKcal: 2000 }),
      day('2026-11-17', { caloriesKcal: 900, caloriesPartial: true }),
      day('2026-11-18', { caloriesKcal: null }),
    ],
  });
  assert.equal(result.loggedDays, 3);
  assert.equal(result.comparableDays, 1);
  assert.equal(result.averageKcal, 2000);
  assert.equal(result.daysOnTarget, 1);
});

test('the macro split is where the energy came from (4-4-9) and adds up to about 100 %', () => {
  const result = summary({ days: [day('2026-11-16', { proteinGrams: 100, carbohydrateGrams: 200, fatGrams: 50 })] });
  // 400 + 800 + 450 = 1650 kcal → 24 %, 48 %, 27 %
  assert.deepEqual(result.macroSplit, { proteinPercent: 24, carbohydratePercent: 48, fatPercent: 27 });
});

test('the change against the previous week needs both averages', () => {
  const week = [day('2026-11-16', { caloriesKcal: 2100 })];
  assert.equal(summary({ days: week, previousDays: [day('2026-11-09', { caloriesKcal: 1900 })] }).kcalChangeVsPrevious, 200);
  assert.equal(summary({ days: week, previousDays: [] }).kcalChangeVsPrevious, null);
  assert.equal(summary({ days: [], previousDays: [day('2026-11-09')] }).kcalChangeVsPrevious, null);
});

test('water average counts only days with logs; goal days use the goal', () => {
  const result = summary({ waterTotals: { '2026-11-16': 2200, '2026-11-17': 1000, '2026-11-18': 2000 }, waterGoalMl: 2000 });
  assert.equal(result.averageWaterMl, 1733);
  assert.equal(result.waterGoalDays, 2);
});

test('weight change is last minus first of the week, in any order, and needs two different logs', () => {
  assert.equal(
    summary({ weights: [{ localDate: '2026-11-20', weightKg: 69.4 }, { localDate: '2026-11-16', weightKg: 70 }] }).weightChangeKg,
    -0.6,
  );
  assert.equal(summary({ weights: [{ localDate: '2026-11-16', weightKg: 70 }] }).weightChangeKg, null);
});
