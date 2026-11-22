import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_PLANNED_REMINDERS,
  planReminders,
  type PlanContext,
} from '../../src/features/reminders/planReminders';
import {
  buildScheduleRequests,
  isSafeReminderRoute,
  routeForReminder,
} from '../../src/features/reminders/schedule';
import {
  DEFAULT_REMINDER_SETTINGS,
  anyReminderEnabled,
  formatTime,
  isTimeOfDay,
  isValidWaterWindow,
  parseReminderSettings,
  toMinutes,
  type ReminderSettings,
} from '../../src/features/reminders/settings';

// Wednesday 18 November 2026, 10:00 local time.
const NOW = new Date(2026, 10, 18, 10, 0, 0);
const NOTHING_DONE: PlanContext = { loggedMealsToday: [], weighedToday: false };

function settings(overrides: Partial<ReminderSettings>): ReminderSettings {
  return { ...DEFAULT_REMINDER_SETTINGS, ...overrides };
}

const hhmm = (date: Date) => formatTime(date.getHours(), date.getMinutes());
const day = (date: Date) => date.getDate();

// ---- Settings --------------------------------------------------------------

test('everything is off by default, so nothing is ever scheduled without being asked', () => {
  assert.equal(anyReminderEnabled(DEFAULT_REMINDER_SETTINGS), false);
  assert.deepEqual(planReminders(DEFAULT_REMINDER_SETTINGS, NOW, NOTHING_DONE), []);
});

test('time helpers validate and convert "HH:MM"', () => {
  assert.equal(isTimeOfDay('09:30'), true);
  for (const bad of ['9:30', '24:00', '12:60', '', 'ab:cd', null, 930]) {
    assert.equal(isTimeOfDay(bad), false, String(bad));
  }
  assert.equal(toMinutes('09:30'), 570);
  assert.equal(formatTime(7, 5), '07:05');
});

test('reading stored settings is forgiving: bad parts fall back to their default', () => {
  assert.deepEqual(parseReminderSettings(null), DEFAULT_REMINDER_SETTINGS);
  assert.deepEqual(parseReminderSettings('not json'), DEFAULT_REMINDER_SETTINGS);
  assert.deepEqual(parseReminderSettings('[1,2]'), DEFAULT_REMINDER_SETTINGS);

  const parsed = parseReminderSettings(
    JSON.stringify({
      breakfast: { enabled: true, time: '08:15' },
      lunch: { enabled: 'yes', time: '99:99' },
      weigh: { enabled: true, weekday: 9, time: '07:00' },
      water: { enabled: true, from: '20:00', to: '10:00', everyHours: 99 },
    }),
  );
  assert.deepEqual(parsed.breakfast, { enabled: true, time: '08:15' });
  assert.deepEqual(parsed.lunch, DEFAULT_REMINDER_SETTINGS.lunch);
  assert.equal(parsed.weigh.weekday, 1, 'weekday out of range → default');
  assert.equal(parsed.weigh.time, '07:00');
  assert.deepEqual([parsed.water.from, parsed.water.to], ['10:00', '20:00'], 'an end before the start → defaults');
  assert.equal(parsed.water.everyHours, 2);
  assert.equal(parsed.water.enabled, true);
});

// ---- Planning --------------------------------------------------------------

test('meal reminders are planned for today (if still ahead) and the next days', () => {
  const plan = planReminders(settings({ lunch: { enabled: true, time: '14:00' } }), NOW, NOTHING_DONE);
  assert.deepEqual(plan.map((p) => [day(p.date), hhmm(p.date)]), [[18, '14:00'], [19, '14:00'], [20, '14:00']]);
  assert.equal(plan.every((p) => p.kind === 'lunch'), true);
});

test('a reminder whose time has already passed today is skipped, tomorrow still counts', () => {
  const plan = planReminders(settings({ breakfast: { enabled: true, time: '09:00' } }), NOW, NOTHING_DONE);
  assert.deepEqual(plan.map((p) => day(p.date)), [19, 20]);
});

test('a reminder less than 30 seconds away counts as already due', () => {
  const almost = new Date(2026, 10, 18, 13, 59, 45);
  const plan = planReminders(settings({ lunch: { enabled: true, time: '14:00' } }), almost, NOTHING_DONE);
  assert.deepEqual(plan.map((p) => day(p.date)), [19, 20]);
});

test('a meal already logged today is not reminded today, but tomorrow is', () => {
  const plan = planReminders(
    settings({ lunch: { enabled: true, time: '14:00' }, dinner: { enabled: true, time: '21:00' } }),
    NOW,
    { loggedMealsToday: ['lunch'], weighedToday: false },
  );
  assert.deepEqual(
    plan.map((p) => `${p.kind}@${day(p.date)}`),
    ['dinner@18', 'lunch@19', 'dinner@19', 'lunch@20', 'dinner@20'],
  );
});

test('water reminders run every N hours between from and to, inclusive', () => {
  const plan = planReminders(
    settings({ water: { enabled: true, from: '10:00', to: '16:00', everyHours: 3 } }),
    new Date(2026, 10, 18, 8, 0, 0),
    NOTHING_DONE,
    1,
  );
  assert.deepEqual(plan.map((p) => hhmm(p.date)), ['10:00', '13:00', '16:00']);
});

test('the weigh-in reminder fires only on its weekday and not if already weighed today', () => {
  // 2026-11-18 is a Wednesday (3). Ask for Wednesday and Thursday.
  const wednesday = settings({ weigh: { enabled: true, weekday: 3, time: '08:30' } });
  const later = new Date(2026, 10, 18, 7, 0, 0);

  assert.deepEqual(planReminders(wednesday, later, NOTHING_DONE, 3).map((p) => day(p.date)), [18]);
  assert.deepEqual(planReminders(wednesday, later, { loggedMealsToday: [], weighedToday: true }, 3), []);

  const thursday = settings({ weigh: { enabled: true, weekday: 4, time: '08:30' } });
  assert.deepEqual(planReminders(thursday, later, NOTHING_DONE, 3).map((p) => day(p.date)), [19]);
});

test('the weekly summary fires on its weekday, also across a month change', () => {
  const monday = settings({ weeklySummary: { enabled: true, weekday: 1, time: '20:00' } });
  const sunday = new Date(2026, 10, 29, 12, 0, 0); // Sunday 29 Nov → Monday is 30 Nov
  const plan = planReminders(monday, sunday, NOTHING_DONE, 3);
  assert.deepEqual(plan.map((p) => [p.date.getMonth() + 1, day(p.date)]), [[11, 30]]);

  // From Thursday 31 Dec the next Monday (4 Jan) is beyond the 3-day horizon: nothing yet.
  assert.deepEqual(planReminders(monday, new Date(2026, 11, 31, 12, 0, 0), NOTHING_DONE, 3), []);

  // From Saturday 2 Jan it falls inside the horizon, in the new year.
  const crossing = planReminders(monday, new Date(2026, 11, 31, 12, 0, 0), NOTHING_DONE, 5);
  assert.deepEqual(crossing.map((p) => [p.date.getFullYear(), p.date.getMonth() + 1, day(p.date)]), [[2027, 1, 4]]);
});

test('the plan is sorted by time, ids are unique, and it never exceeds the cap', () => {
  const everything = settings({
    breakfast: { enabled: true, time: '09:00' },
    lunch: { enabled: true, time: '14:00' },
    dinner: { enabled: true, time: '21:00' },
    water: { enabled: true, from: '08:00', to: '22:00', everyHours: 1 },
  });
  const plan = planReminders(everything, new Date(2026, 10, 18, 0, 0, 0), NOTHING_DONE, 10);

  assert.equal(plan.length, MAX_PLANNED_REMINDERS);
  assert.equal(new Set(plan.map((p) => p.id)).size, plan.length);
  for (let i = 1; i < plan.length; i += 1) {
    assert.ok(plan[i]!.date.getTime() >= plan[i - 1]!.date.getTime());
  }
});

test('the same input always gives the same plan', () => {
  const config = settings({ lunch: { enabled: true, time: '14:00' }, water: { enabled: true, from: '10:00', to: '14:00', everyHours: 2 } });
  assert.deepEqual(planReminders(config, NOW, NOTHING_DONE), planReminders(config, NOW, NOTHING_DONE));
});

// ---- Scheduling requests ---------------------------------------------------

test('every reminder becomes a request with a stable identifier and a tap target', () => {
  const plan = planReminders(
    settings({
      lunch: { enabled: true, time: '14:00' },
      weigh: { enabled: true, weekday: 3, time: '17:00' },
      weeklySummary: { enabled: true, weekday: 3, time: '20:00' },
    }),
    NOW,
    NOTHING_DONE,
    1,
  );
  const requests = buildScheduleRequests(plan);

  assert.equal(requests.length, plan.length);
  assert.equal(new Set(requests.map((r) => r.identifier)).size, requests.length, 'identifiers are unique');
  for (const request of requests) {
    assert.match(request.identifier, /^reminder-[A-Za-z]+-\d{4}-\d{2}-\d{2}-\d{4}$/);
    assert.ok(isSafeReminderRoute(request.data.route), request.data.route);
  }
  assert.equal(requests.find((r) => r.data.kind === 'lunch')?.data.route, '/diary/add-food?meal=lunch');
  assert.equal(requests.find((r) => r.data.kind === 'weigh')?.data.route, '/(tabs)/progress');
  assert.equal(requests.find((r) => r.data.kind === 'weeklySummary')?.data.route, '/summary');
});

test('every kind of reminder points to a screen that exists', () => {
  for (const kind of ['breakfast', 'lunch', 'dinner', 'water', 'weigh', 'weeklySummary'] as const) {
    assert.ok(isSafeReminderRoute(routeForReminder(kind)), kind);
  }
});

test('only the screens a reminder can open are accepted from a notification payload', () => {
  assert.equal(isSafeReminderRoute('/summary'), true);
  for (const bad of ['/foods/abc', 'https://example.com', '/diary/add-food?meal=snack', '', null, undefined, 7]) {
    assert.equal(isSafeReminderRoute(bad), false, String(bad));
  }
});

test('the water window needs a start before its end', () => {
  assert.equal(isValidWaterWindow('10:00', '20:00'), true);
  assert.equal(isValidWaterWindow('20:00', '10:00'), false);
  assert.equal(isValidWaterWindow('10:00', '10:00'), false);
  assert.equal(isValidWaterWindow('25:00', '26:00'), false);
});
