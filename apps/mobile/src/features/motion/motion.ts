import { LayoutAnimation, Platform, UIManager } from 'react-native';

export const durations = {
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
} as const;

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
  LayoutAnimation.configureNext(LayoutAnimation.Presets[type]);
}
