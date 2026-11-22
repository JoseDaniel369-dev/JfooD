import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getReminderContext } from '@/data/sqlite/repositories/reminderRepository';
import { getSetting, setSetting } from '@/data/sqlite/repositories/settingsRepository';
import { toLocalDate } from '@/features/diary/utils/date';

import { planReminders } from './planReminders';
import { REMINDER_CHANNEL_ID, buildScheduleRequests } from './schedule';
import {
  REMINDERS_SETTING_KEY,
  anyReminderEnabled,
  parseReminderSettings,
  type ReminderSettings,
} from './settings';

/** Notifications only exist on the phone builds. */
const SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

/** Shows a reminder as a banner even while the app is open. */
export function configureNotificationHandler(): void {
  if (!SUPPORTED) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android needs the channel to exist before a permission request or a schedule. */
export async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Recordatorios',
    description: 'Avisos de comidas, agua, peso y resumen semanal.',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!SUPPORTED) return 'denied';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    return current.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Asks for the permission (the system shows its dialog only when it still can). */
export async function requestReminderPermission(): Promise<boolean> {
  if (!SUPPORTED) return false;
  try {
    await ensureReminderChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function loadReminderSettings(database: SQLiteDatabase): Promise<ReminderSettings> {
  return parseReminderSettings(await getSetting(database, REMINDERS_SETTING_KEY));
}

export async function saveReminderSettings(
  database: SQLiteDatabase,
  settings: ReminderSettings,
): Promise<void> {
  await setSetting(database, REMINDERS_SETTING_KEY, JSON.stringify(settings));
}

async function rebuild(database: SQLiteDatabase): Promise<void> {
  const settings = await loadReminderSettings(database);

  if (!anyReminderEnabled(settings) || (await getReminderPermission()) !== 'granted') {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  await ensureReminderChannel();
  const now = new Date();
  const context = await getReminderContext(database, toLocalDate(now));
  const requests = buildScheduleRequests(planReminders(settings, now, context));

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const request of requests) {
    await Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: { title: request.title, body: request.body, data: request.data },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.date,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  }
}

let inFlight: Promise<void> | null = null;
let again = false;

/**
 * Cancels and re-plans every reminder from the saved settings and what is
 * already done today. Safe to call from anywhere, as often as needed: runs never
 * overlap (a call during a run just asks for one more pass), and it never
 * throws, because a reminder problem must not break the screen that called it.
 */
export function scheduleReminders(database: SQLiteDatabase): Promise<void> {
  if (!SUPPORTED) return Promise.resolve();
  if (inFlight) {
    again = true;
    return inFlight;
  }

  inFlight = (async () => {
    try {
      do {
        again = false;
        try {
          await rebuild(database);
        } catch {
          // Nothing to do: the next trigger (opening the app, adding a meal) retries.
        }
      } while (again);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
