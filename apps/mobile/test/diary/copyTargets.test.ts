import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COPY_TARGET_DAYS, buildCopyTargets } from '../../src/features/diary/utils/copyTargets';

// Sunday 22 November 2026.
const TODAY = '2026-11-22';

test('the quick choices start today and name the next days', () => {
  const targets = buildCopyTargets(TODAY, '2026-11-10');

  assert.equal(targets.length, COPY_TARGET_DAYS);
  assert.deepEqual(targets.slice(0, 3), [
    { date: '2026-11-22', label: 'Hoy' },
    { date: '2026-11-23', label: 'Mañana' },
    { date: '2026-11-24', label: 'Mar 24' },
  ]);
});

test('the day the meal is already on is not offered', () => {
  const fromToday = buildCopyTargets(TODAY, TODAY);
  assert.equal(fromToday.some((t) => t.date === TODAY), false);
  assert.equal(fromToday[0]?.label, 'Mañana');

  const fromTomorrow = buildCopyTargets(TODAY, '2026-11-23');
  assert.deepEqual(
    fromTomorrow.map((t) => t.date),
    ['2026-11-22', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'],
  );
});

test('the choices cross month and year ends', () => {
  const targets = buildCopyTargets('2026-12-30', '2026-12-29');
  assert.deepEqual(
    targets.map((t) => t.date),
    ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04'],
  );
  assert.equal(targets[3]?.label, 'Sáb 2');
});
