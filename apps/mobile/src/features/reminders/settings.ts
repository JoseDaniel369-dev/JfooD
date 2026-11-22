/**
 * Reminder preferences. Stored as JSON in app_settings under `reminders_v1`.
 * Reading is forgiving: anything missing or malformed falls back to the default
 * of that field, so a corrupt or older value can never break the app.
 */

/** "HH:MM", 24 hours. */
export type TimeOfDay = string;

/** 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MealReminder {
  enabled: boolean;
  time: TimeOfDay;
}

export interface WaterReminder {
  enabled: boolean;
  from: TimeOfDay;
  to: TimeOfDay;
  everyHours: number;
}

export interface WeeklyReminder {
  enabled: boolean;
  weekday: Weekday;
  time: TimeOfDay;
}

export interface ReminderSettings {
  breakfast: MealReminder;
  lunch: MealReminder;
  dinner: MealReminder;
  water: WaterReminder;
  weigh: WeeklyReminder;
  weeklySummary: WeeklyReminder;
}

export const REMINDERS_SETTING_KEY = 'reminders_v1';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  breakfast: { enabled: false, time: '09:00' },
  lunch: { enabled: false, time: '14:00' },
  dinner: { enabled: false, time: '21:00' },
  water: { enabled: false, from: '10:00', to: '20:00', everyHours: 2 },
  weigh: { enabled: false, weekday: 1, time: '08:30' },
  weeklySummary: { enabled: false, weekday: 1, time: '20:00' },
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === 'string' && TIME.test(value);
}

/** Minutes since midnight of a valid "HH:MM". */
export function toMinutes(time: TimeOfDay): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}

export function formatTime(hours: number, minutes: number): TimeOfDay {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTime(value: unknown, fallback: TimeOfDay): TimeOfDay {
  return isTimeOfDay(value) ? value : fallback;
}

function readFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readMeal(value: unknown, fallback: MealReminder): MealReminder {
  const source = isRecord(value) ? value : {};
  return { enabled: readFlag(source.enabled, fallback.enabled), time: readTime(source.time, fallback.time) };
}

function readWeekday(value: unknown, fallback: Weekday): Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7
    ? (value as Weekday)
    : fallback;
}

function readWeekly(value: unknown, fallback: WeeklyReminder): WeeklyReminder {
  const source = isRecord(value) ? value : {};
  return {
    enabled: readFlag(source.enabled, fallback.enabled),
    weekday: readWeekday(source.weekday, fallback.weekday),
    time: readTime(source.time, fallback.time),
  };
}

/** Parses the stored JSON; never throws. */
export function parseReminderSettings(raw: string | null | undefined): ReminderSettings {
  let source: unknown = null;
  try {
    source = raw ? JSON.parse(raw) : null;
  } catch {
    source = null;
  }
  const data = isRecord(source) ? source : {};
  const d = DEFAULT_REMINDER_SETTINGS;
  const water = isRecord(data.water) ? data.water : {};

  const from = readTime(water.from, d.water.from);
  const to = readTime(water.to, d.water.to);
  const every =
    typeof water.everyHours === 'number' && Number.isInteger(water.everyHours) && water.everyHours >= 1 && water.everyHours <= 6
      ? water.everyHours
      : d.water.everyHours;

  return {
    breakfast: readMeal(data.breakfast, d.breakfast),
    lunch: readMeal(data.lunch, d.lunch),
    dinner: readMeal(data.dinner, d.dinner),
    water: {
      enabled: readFlag(water.enabled, d.water.enabled),
      // An end before the start would never fire: fall back to the defaults.
      ...(toMinutes(from) < toMinutes(to) ? { from, to } : { from: d.water.from, to: d.water.to }),
      everyHours: every,
    },
    weigh: readWeekly(data.weigh, d.weigh),
    weeklySummary: readWeekly(data.weeklySummary, d.weeklySummary),
  };
}

/** True when at least one reminder is on. */
export function anyReminderEnabled(settings: ReminderSettings): boolean {
  return (
    settings.breakfast.enabled ||
    settings.lunch.enabled ||
    settings.dinner.enabled ||
    settings.water.enabled ||
    settings.weigh.enabled ||
    settings.weeklySummary.enabled
  );
}
