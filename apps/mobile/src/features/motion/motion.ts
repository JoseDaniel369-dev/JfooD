import {
  AccessibilityInfo,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

let reducedMotion = false;

// Respect the system "remove animations" setting. The flag is read lazily by
// the helpers below, so a change while the app is open is honoured too.
AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => {
    reducedMotion = enabled;
  })
  .catch(() => {
    // Keep animations on if the setting cannot be read.
  });
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
  reducedMotion = enabled;
});

export function isReducedMotion(): boolean {
  return reducedMotion;
}

/** Durations in ms; they collapse to 0 when the user asked for less motion. */
export const durations = {
  get fast(): number {
    return reducedMotion ? 0 : 150;
  },
  get normal(): number {
    return reducedMotion ? 0 : 250;
  },
  get slow(): number {
    return reducedMotion ? 0 : 400;
  },
  get slower(): number {
    return reducedMotion ? 0 : 600;
  },
};

export const easings = {
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
} as const;

export const springConfigs = {
  button: { friction: 7, tension: 300 },
  gentle: { friction: 8, tension: 120 },
  snappy: { friction: 5, tension: 400 },
} as const;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Anima el próximo cambio de layout (añadir/eliminar/actualizar hijos).
 * Útil para listas que cambian de tamaño al insertar/borrar elementos.
 */
export function animateNextLayout(
  type: 'easeInEaseOut' | 'spring' | 'linear' = 'easeInEaseOut',
): void {
  if (reducedMotion) {
    return;
  }
  LayoutAnimation.configureNext(LayoutAnimation.Presets[type]);
}
