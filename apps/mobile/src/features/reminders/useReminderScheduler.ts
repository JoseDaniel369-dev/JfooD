import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { configureNotificationHandler, scheduleReminders } from './notifications';
import { isSafeReminderRoute } from './schedule';

/**
 * Keeps the reminders in step with the app: plans them when it opens and each
 * time it comes back to the foreground, and opens the right screen when the
 * person taps one. Mount once, inside the database provider.
 */
export function useReminderScheduler(): void {
  const database = useSQLiteContext();

  useEffect(() => {
    configureNotificationHandler();
    void scheduleReminders(database);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void scheduleReminders(database);
      }
    });
    return () => subscription.remove();
  }, [database]);

  // The notification that opened the app (or was tapped while it was running).
  const response = Notifications.useLastNotificationResponse();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handledRef.current === key) {
      return;
    }
    handledRef.current = key;

    const route = response.notification.request.content.data?.route;
    if (isSafeReminderRoute(route)) {
      // typedRoutes only knows literal paths; the allow-list above keeps this safe.
      router.push(route as never);
    }
  }, [response]);
}
