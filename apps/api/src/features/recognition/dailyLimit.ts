/**
 * In-memory daily budget for calls that cost Gemini quota. It resets at UTC
 * midnight and on restart, which is enough to cap abuse on a free tier without
 * adding a database.
 */
export interface DailyLimiter {
  /** Reserves one call. Returns false when today's budget is exhausted. */
  tryConsume(): boolean;
  /**
   * Gives back a reservation whose call never produced a result. Pass the day
   * the reservation was made (`today()` at that moment): a refund that arrives
   * after UTC midnight belongs to a budget that no longer exists and is ignored.
   */
  refund(reservedOn?: string): void;
  remaining(): number;
  /** The UTC day this budget is counting (YYYY-MM-DD). */
  today(): string;
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
    refund(reservedOn) {
      rollover();
      if (reservedOn !== undefined && reservedOn !== day) {
        return;
      }
      used = Math.max(0, used - 1);
    },
    remaining() {
      rollover();
      return Math.max(0, limit - used);
    },
    today() {
      rollover();
      return day;
    },
  };
}

/** Largest number of distinct clients tracked per day (bounds memory use). */
const MAX_TRACKED_KEYS = 10_000;

/** Daily budget per client (for example per IP), so one client cannot drain the global one. */
export interface KeyedDailyLimiter {
  tryConsume(key: string): boolean;
  /** Same rule as the shared budget: a refund from a previous UTC day is ignored. */
  refund(key: string, reservedOn?: string): void;
  /** True when this client was refused only because the table of tracked clients is full. */
  isTableFullFor(key: string): boolean;
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
    isTableFullFor(key) {
      rollover();
      return !used.has(key) && used.size >= MAX_TRACKED_KEYS;
    },
    refund(key, reservedOn) {
      rollover();
      if (reservedOn !== undefined && reservedOn !== day) {
        return;
      }
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
