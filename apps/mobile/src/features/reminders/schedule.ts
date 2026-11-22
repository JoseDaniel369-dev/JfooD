import type { PlannedReminder, ReminderKind } from './planReminders';

/** Every reminder identifier starts with this, so the app's own can be told apart. */
export const REMINDER_ID_PREFIX = 'reminder-';

/** Android notification channel every reminder goes through. */
export const REMINDER_CHANNEL_ID = 'recordatorios';

/** A reminder ready to hand to the notifications library. */
export interface ScheduleRequest {
  identifier: string;
  title: string;
  body: string;
  /** Delivered back when the person taps the notification. */
  data: { kind: ReminderKind; route: string };
  date: Date;
}

/** Where tapping a reminder should take the person. */
export function routeForReminder(kind: ReminderKind): string {
  switch (kind) {
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      return `/diary/add-food?meal=${kind}`;
    case 'water':
      return '/(tabs)';
    case 'weigh':
      return '/(tabs)/progress';
    case 'weeklySummary':
      return '/summary';
  }
}

const SAFE_ROUTES = new Set<string>([
  '/diary/add-food?meal=breakfast',
  '/diary/add-food?meal=lunch',
  '/diary/add-food?meal=dinner',
  '/(tabs)',
  '/(tabs)/progress',
  '/summary',
]);

/**
 * A notification payload is outside input (an old build, another app sharing
 * the id space): only navigate to the screens a reminder can really point to.
 */
export function isSafeReminderRoute(route: unknown): route is string {
  return typeof route === 'string' && SAFE_ROUTES.has(route);
}

/** Turns the plan into notification requests (stable identifiers, tap target). */
export function buildScheduleRequests(plan: readonly PlannedReminder[]): ScheduleRequest[] {
  return plan.map((reminder) => ({
    // "breakfast-2026-11-18-09:00" → "reminder-breakfast-2026-11-18-0900"
    identifier: `${REMINDER_ID_PREFIX}${reminder.id.replace(/:/g, '')}`,
    title: reminder.title,
    body: reminder.body,
    data: { kind: reminder.kind, route: routeForReminder(reminder.kind) },
    date: reminder.date,
  }));
}
