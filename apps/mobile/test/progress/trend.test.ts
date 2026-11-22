import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeChange,
  computeWeeklyTrend,
  weightChangeTone,
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

describe('weightChangeTone', () => {
  it('is good when the weight moves the way the goal asks', () => {
    assert.equal(weightChangeTone(-0.4, 'lose'), 'good');
    assert.equal(weightChangeTone(0.4, 'gain'), 'good');
  });

  it('asks for attention (never "error") when it moves the other way', () => {
    assert.equal(weightChangeTone(0.4, 'lose'), 'attention');
    assert.equal(weightChangeTone(-0.4, 'gain'), 'attention');
  });

  it('is neutral when maintaining, unchanged, unknown or without a goal', () => {
    assert.equal(weightChangeTone(1, 'maintain'), 'neutral');
    assert.equal(weightChangeTone(0, 'lose'), 'neutral');
    assert.equal(weightChangeTone(null, 'lose'), 'neutral');
    assert.equal(weightChangeTone(-1, null), 'neutral');
  });
});
