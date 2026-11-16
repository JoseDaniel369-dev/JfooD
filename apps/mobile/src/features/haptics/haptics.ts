import * as Haptics from 'expo-haptics';

function safeRun(action: () => Promise<void>): void {
  try {
    action().catch(() => {
      // Haptics are best-effort; never let them break a flow.
    });
  } catch {
    // Haptics are best-effort; never let them break a flow.
  }
}

export function hapticSuccess(): void {
  safeRun(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function hapticWarning(): void {
  safeRun(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}

export function hapticSelection(): void {
  safeRun(() => Haptics.selectionAsync());
}

export function hapticImpact(): void {
  safeRun(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
