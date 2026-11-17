/**
 * In-memory daily budget for calls that cost Gemini quota. It resets at UTC
 * midnight and on restart, which is enough to cap abuse on a free tier without
 * adding a database.
 */
export interface DailyLimiter {
  /** Reserves one call. Returns false when today's budget is exhausted. */
  tryConsume(): boolean;
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
    remaining() {
      rollover();
      return Math.max(0, limit - used);
    },
  };
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
