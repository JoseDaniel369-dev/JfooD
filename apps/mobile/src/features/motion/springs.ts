import { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

/**
 * Shared spring configs and entering/layout builders for Reanimated.
 *
 * Reanimated animations follow the system "remove animations" setting on their
 * own (ReduceMotion.System is the default), so nothing here needs to check it.
 */
export const springs = {
  /** Fast and tight: press feedback. */
  press: { damping: 14, stiffness: 420, mass: 0.5 },
  /** Calm settle: bars, rings, panels. */
  soft: { damping: 20, stiffness: 160, mass: 1 },
  /** A little overshoot: celebrations, the central "+" button. */
  bouncy: { damping: 11, stiffness: 200, mass: 0.9 },
} as const;

/** Longest list that still staggers: later items would wait too long. */
export const MAX_STAGGERED_ITEMS = 8;

/** Delay in ms of the item at `index` of a staggered entrance. */
export function staggerDelay(index: number, step = 55): number {
  return Math.min(Math.max(index, 0), MAX_STAGGERED_ITEMS) * step;
}

/** Card/row entrance: fades up with a soft spring, one after another. */
export function staggerIn(index: number, step = 55) {
  return FadeInDown.delay(staggerDelay(index, step))
    .springify()
    .damping(18)
    .stiffness(140);
}

/** One block fading up with a soft spring, after `delayMs`. */
export function fadeUp(delayMs = 0) {
  return FadeInDown.delay(delayMs).springify().damping(18).stiffness(140);
}

/** Rows that move smoothly when an item is added or removed above them. */
export const rowLayout = LinearTransition.springify().damping(20).stiffness(180);

export const fadeIn = FadeIn.duration(250);
