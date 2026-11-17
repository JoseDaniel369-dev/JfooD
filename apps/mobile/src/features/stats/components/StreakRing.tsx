import type { PropsWithChildren } from 'react';

import { ProgressRing } from '@/components/ProgressRing';

interface StreakRingProps extends PropsWithChildren {
  /** Value displayed (e.g. current streak days). */
  value: number;
  /** Maximum used for the ring progress (e.g. 7 or best streak). */
  maximum: number;
  size?: number;
  strokeWidth?: number;
}

/** Streak progress: a ProgressRing with the streak description for screen readers. */
export function StreakRing({ value, maximum, ...rest }: StreakRingProps) {
  return (
    <ProgressRing
      accessibilityLabel={`Racha de ${value} de ${maximum} días`}
      maximum={maximum}
      value={value}
      {...rest}
    />
  );
}
