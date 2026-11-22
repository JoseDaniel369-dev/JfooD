import type { MealType } from '@/features/diary/types';

import { toMinutes, type ReminderSettings, type TimeOfDay } from './settings';

export type ReminderKind = 'breakfast' | 'lunch' | 'dinner' | 'water' | 'weigh' | 'weeklySummary';

export interface PlannedReminder {
  /** Stable for the same reminder, so tests and logs are readable. */
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  /** When it should appear (local time). */
  date: Date;
}

export interface PlanContext {
  /** Meals that already have entries today: their reminder is skipped for today. */
  loggedMealsToday: readonly MealType[];
  /** Weight already logged today: the weigh-in reminder is skipped for today. */
  weighedToday: boolean;
}

/** Days ahead that are scheduled; the plan is rebuilt every time the app opens. */
export const PLAN_HORIZON_DAYS = 3;
/** iOS keeps at most 64 pending notifications; stay below it. */
export const MAX_PLANNED_REMINDERS = 60;
/** A reminder this close to "now" is considered already due. */
const MIN_LEAD_MS = 30_000;

const MEAL_COPY: Record<'breakfast' | 'lunch' | 'dinner', { title: string; body: string }> = {
  breakfast: { title: '🍳 Hora del desayuno', body: 'Regístralo en JfooD en un momento.' },
  lunch: { title: '🥗 Hora de comer', body: '¿Qué hay hoy en el plato? Anótalo.' },
  dinner: { title: '🍝 Hora de la cena', body: 'Cierra el día: registra tu cena.' },
};

function atTime(day: Date, time: TimeOfDay): Date {
  const minutes = toMinutes(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0);
}

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 1 = Monday … 7 = Sunday. */
function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

/**
 * The notifications to schedule for the next few days, soonest first. Pure:
 * the same settings, moment and day give the same plan. A reminder for
 * something that is already done today (a meal logged, weight entered) is left
 * out, and nothing is planned in the past.
 */
export function planReminders(
  settings: ReminderSettings,
  now: Date,
  context: PlanContext,
  horizonDays = PLAN_HORIZON_DAYS,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const earliest = now.getTime() + MIN_LEAD_MS;

  const add = (kind: ReminderKind, key: string, title: string, body: string, date: Date) => {
    if (date.getTime() >= earliest) {
      planned.push({ id: `${kind}-${key}`, kind, title, body, date });
    }
  };

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = dateKey(day);
    const today = offset === 0;

    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      const reminder = settings[meal];
      if (!reminder.enabled) continue;
      if (today && context.loggedMealsToday.includes(meal)) continue;
      add(meal, `${key}-${reminder.time}`, MEAL_COPY[meal].title, MEAL_COPY[meal].body, atTime(day, reminder.time));
    }

    if (settings.water.enabled) {
      const start = toMinutes(settings.water.from);
      const end = toMinutes(settings.water.to);
      for (let minutes = start; minutes <= end; minutes += settings.water.everyHours * 60) {
        const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        add('water', `${key}-${time}`, '💧 Un vaso de agua', 'Mantén el ritmo: ¡a beber!', atTime(day, time));
      }
    }

    if (settings.weigh.enabled && isoWeekday(day) === settings.weigh.weekday && !(today && context.weighedToday)) {
      add('weigh', `${key}-${settings.weigh.time}`, '⚖️ Día de pesarse', 'Un minuto y tu progreso queda al día.', atTime(day, settings.weigh.time));
    }

    if (settings.weeklySummary.enabled && isoWeekday(day) === settings.weeklySummary.weekday) {
      add(
        'weeklySummary',
        `${key}-${settings.weeklySummary.time}`,
        '📊 Tu resumen semanal',
        'Mira cómo ha ido tu semana.',
        atTime(day, settings.weeklySummary.time),
      );
    }
  }

  return planned
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id))
    .slice(0, MAX_PLANNED_REMINDERS);
}
