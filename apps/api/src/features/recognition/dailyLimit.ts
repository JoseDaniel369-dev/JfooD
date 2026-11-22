/**
 * In-memory daily budget for calls that cost Gemini quota. It resets at UTC
 * midnight and on restart, which is enough to cap abuse on a free tier without
 * adding a database.
 */
export interface DailyLimiter {
  /** Reserves one call. Returns false when today's budget is exhausted. */
  tryConsume(): boolean;
  /** Gives back a reservation whose call never produced a result. */
  refund(): void;
  remaining(): number;
}

export function createDailyLimiter(
  limit: number,
  now: () => Date = () => new Date(),
): DailyLimiter {
  let day = utcDay(now());
  let used = 0;

  function rollover(): void {
    const today = utcDay(now());
    if (today !== day) {
      day = today;
      used = 0;
    }
  }

  return {
    tryConsume() {
      rollover();
      if (used >= limit) {
        return false;
      }
      used += 1;
      return true;
    },
    refund() {
      rollover();
      used = Math.max(0, used - 1);
    },
    remaining() {
      rollover();
      return Math.max(0, limit - used);
    },
  };
}

/** Largest number of distinct clients tracked per day (bounds memory use). */
const MAX_TRACKED_KEYS = 10_000;

/** Daily budget per client (for example per IP), so one client cannot drain the global one. */
export interface KeyedDailyLimiter {
  tryConsume(key: string): boolean;
  refund(key: string): void;
}

export function createKeyedDailyLimiter(
  limitPerKey: number,
  now: () => Date = () => new Date(),
): KeyedDailyLimiter {
  let day = utcDay(now());
  let used = new Map<string, number>();

  function rollover(): void {
    const today = utcDay(now());
    if (today !== day) {
      day = today;
      used = new Map();
    }
  }

  return {
    tryConsume(key) {
      rollover();
      const current = used.get(key) ?? 0;
      if (current >= limitPerKey) {
        return false;
      }
      // Never grow without bound: when the table is full, unknown clients are
      // refused rather than evicting the ones already counted.
      if (current === 0 && used.size >= MAX_TRACKED_KEYS) {
        return false;
      }
      used.set(key, current + 1);
      return true;
    },
    refund(key) {
      rollover();
      const current = used.get(key) ?? 0;
      if (current <= 1) {
        used.delete(key);
      } else {
        used.set(key, current - 1);
      }
    },
  };
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
