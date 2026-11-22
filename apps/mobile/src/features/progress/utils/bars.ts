export interface BarInput {
  /** Value of the bar; null = nothing logged that day. */
  value: number | null;
  /** The value is only a minimum (some data was missing). */
  approximate?: boolean;
}

export interface Bar {
  /** Left edge, px. */
  x: number;
  /** Top edge, px (0 is the top of the chart). */
  y: number;
  width: number;
  height: number;
  kind: 'empty' | 'normal' | 'approximate';
}

export interface BarLayout {
  bars: Bar[];
  /** Top of the goal line, px, or null when there is no goal. */
  goalY: number | null;
  /** The value that fills the full height. */
  maximum: number;
}

/** Height of the thin stub drawn for days without data, px. */
const EMPTY_BAR_PX = 3;
/** Shortest bar that still has data, px, so a tiny value stays visible. */
const MIN_BAR_PX = 6;

/**
 * Where to draw each bar and the goal line. The scale fits the highest value or
 * the goal, so the goal line is always inside the chart. Pure, so it is tested
 * without drawing anything.
 */
export function buildBars(
  inputs: readonly BarInput[],
  goal: number | null,
  width: number,
  height: number,
  gap = 3,
): BarLayout {
  const count = inputs.length;
  if (count === 0 || !(width > 0) || !(height > 0)) {
    return { bars: [], goalY: null, maximum: 0 };
  }

  const highest = Math.max(0, ...inputs.map((input) => input.value ?? 0));
  const maximum = Math.max(highest, goal ?? 0, 1);
  const barWidth = Math.max(1, (width - gap * (count - 1)) / count);

  const bars = inputs.map<Bar>((input, index) => {
    const x = index * (barWidth + gap);

    if (input.value === null) {
      return { x, y: height - EMPTY_BAR_PX, width: barWidth, height: EMPTY_BAR_PX, kind: 'empty' };
    }

    const barHeight = Math.max(MIN_BAR_PX, (input.value / maximum) * height);
    return {
      x,
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
      kind: input.approximate ? 'approximate' : 'normal',
    };
  });

  return {
    bars,
    goalY: goal !== null && goal > 0 ? height - (goal / maximum) * height : null,
    maximum,
  };
}
