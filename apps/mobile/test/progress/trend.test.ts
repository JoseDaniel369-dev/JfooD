import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeChange,
  computeWeeklyTrend,
  type TrendLog,
} from '@/features/progress/utils/trend';

describe('computeChange', () => {
  it('returns the absolute difference when there is a previous value', () => {
    assert.equal(computeChange(72.5, 73), -0.5);
  });

  it('returns null when there is no previous value', () => {
    assert.equal(computeChange(72.5, null), null);
  });

  it('rounds to two decimals', () => {
    assert.equal(computeChange(70.123, 69.456), 0.67);
  });
});

describe('computeWeeklyTrend', () => {
  it('returns null for an empty list', () => {
    assert.equal(computeWeeklyTrend([]), null);
  });

  it('returns the only weight when there is a single log', () => {
    assert.equal(computeWeeklyTrend([{ localDate: '2026-11-07', weightKg: 70 }]), 70);
  });

  it('averages the logs within the last 7 calendar days', () => {
    const logs: TrendLog[] = [
      { localDate: '2026-10-31', weightKg: 72 },
      { localDate: '2026-11-06', weightKg: 71 },
      { localDate: '2026-11-07', weightKg: 70 },
    ];

    assert.equal(computeWeeklyTrend(logs), 70.5);
  });

  it('ignores logs older than 7 days from the most recent one', () => {
    const logs: TrendLog[] = [
      { localDate: '2026-10-25', weightKg: 75 },
      { localDate: '2026-11-01', weightKg: 72 },
      { localDate: '2026-11-07', weightKg: 70 },
    ];

    assert.equal(computeWeeklyTrend(logs), 71);
  });
});
