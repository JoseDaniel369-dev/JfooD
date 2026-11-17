export interface ChartLog {
  localDate: string;
  weightKg: number;
}

export interface ChartPoint extends ChartLog {
  /** Horizontal position inside the plot area (0 … plotWidth). */
  x: number;
  /** Vertical position inside the plot area (0 … plotHeight, top is 0). */
  y: number;
}

const DAY_MS = 86_400_000;

/** Whole days since 1970-01-01 for a YYYY-MM-DD date (timezone independent). */
export function dayNumber(localDate: string): number {
  const [year, month, day] = localDate.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/**
 * Positions weight logs for a line chart. The X axis is proportional to the
 * calendar, so a two-week gap looks like a gap instead of two adjacent points.
 * Logs must be sorted by date ascending.
 */
export function computeChartPoints(
  logs: readonly ChartLog[],
  plotWidth: number,
  plotHeight: number,
  verticalMargin = 8,
): ChartPoint[] {
  if (logs.length === 0) {
    return [];
  }

  const weights = logs.map((log) => log.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = Math.max(maxWeight - minWeight, 0.5);

  const firstDay = dayNumber(logs[0]!.localDate);
  const span = dayNumber(logs[logs.length - 1]!.localDate) - firstDay;
  const usableHeight = plotHeight - verticalMargin * 2;

  return logs.map((log) => ({
    ...log,
    x: span === 0 ? plotWidth / 2 : ((dayNumber(log.localDate) - firstDay) / span) * plotWidth,
    y: verticalMargin + usableHeight - ((log.weightKg - minWeight) / range) * usableHeight,
  }));
}

/** Left offset (px) that centres a tooltip on a point without leaving the container. */
export function tooltipLeft(
  pointX: number,
  tooltipWidth: number,
  containerWidth: number,
): number {
  const centred = pointX - tooltipWidth / 2;
  return Math.min(Math.max(centred, 0), Math.max(containerWidth - tooltipWidth, 0));
}
