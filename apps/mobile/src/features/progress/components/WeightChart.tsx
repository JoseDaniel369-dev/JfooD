import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { formatShortDate } from '@/features/diary/utils/date';
import { fadeUp } from '@/features/motion/springs';
import { computeChartPoints, tooltipLeft, type ChartLog } from '@/features/progress/utils/chart';
import { fonts, fontSizes, radius, shadows, spacing, typography, useTheme, type ThemeColors } from '@/theme';

const HEIGHT = 190;
const PAD = { top: 12, bottom: 28, left: 40, right: 12 } as const;
/** Same vertical margin computeChartPoints keeps inside the plot (the labels must match it). */
const MARGIN = 8;
/** With more points than this the dots are only drawn for the one being inspected. */
const MAX_DOTS = 30;

interface WeightChartProps {
  /** Logs sorted by date, oldest first (at least two). */
  logs: readonly ChartLog[];
}

/**
 * Weight over time: a line with the min/max on the left, the first and last day
 * below, and a tooltip that follows the finger (drag along the chart or tap a day).
 */
export function WeightChart({ logs }: WeightChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const points = useMemo(
    () => computeChartPoints(logs, plotWidth, plotHeight, MARGIN),
    [logs, plotWidth, plotHeight],
  );

  const weights = logs.map((log) => log.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  // computeChartPoints never draws a range under 0.5 kg.
  const topWeight = minWeight + Math.max(maxWeight - minWeight, 0.5);

  const first = points[0];
  const last = points[points.length - 1];
  const selected = selectedIndex !== null ? (points[selectedIndex] ?? null) : null;

  const selectNearest = useCallback(
    (touchX: number) => {
      const x = touchX - PAD.left;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      points.forEach((point, index) => {
        const distance = Math.abs(point.x - x);
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });
      setSelectedIndex(best);
    },
    [points],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onBegin((event) => scheduleOnRN(selectNearest, event.x))
      .onUpdate((event) => scheduleOnRN(selectNearest, event.x));
    const tap = Gesture.Tap().onEnd((event) => scheduleOnRN(selectNearest, event.x));
    return Gesture.Simultaneous(pan, tap);
  }, [selectNearest]);

  if (!first || !last) return null;

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x + PAD.left} ${point.y + PAD.top}`)
    .join(' ');
  const baseline = PAD.top + plotHeight;
  const areaPath = `${linePath} L ${last.x + PAD.left} ${baseline} L ${first.x + PAD.left} ${baseline} Z`;

  const yTop = PAD.top + MARGIN;
  const yBottom = PAD.top + plotHeight - MARGIN;
  const yMid = (yTop + yBottom) / 2;

  const summary = `Gráfico de peso. Desde ${first.weightKg.toFixed(1)} kilos el ${formatShortDate(first.localDate)} hasta ${last.weightKg.toFixed(1)} kilos el ${formatShortDate(last.localDate)}. Mínimo ${minWeight.toFixed(1)}, máximo ${maxWeight.toFixed(1)}.`;

  return (
    <View
      accessible
      accessibilityLabel={summary}
      accessibilityRole="image"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}
    >
      <GestureDetector gesture={gesture}>
        <View>
          <Svg height={HEIGHT} width={width}>
            <Defs>
              <LinearGradient id="weightArea" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {[yTop, yMid, yBottom].map((y) => (
              <Line
                key={y}
                stroke={colors.border}
                strokeDasharray="4 5"
                strokeWidth={1}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y}
                y2={y}
              />
            ))}
            <SvgText fill={colors.textMuted} fontFamily={fonts.semibold} fontSize={fontSizes.small} textAnchor="end" x={PAD.left - 6} y={yTop + 4}>
              {topWeight.toFixed(1)}
            </SvgText>
            <SvgText fill={colors.textMuted} fontFamily={fonts.semibold} fontSize={fontSizes.small} textAnchor="end" x={PAD.left - 6} y={yBottom + 4}>
              {minWeight.toFixed(1)}
            </SvgText>

            <Path d={areaPath} fill="url(#weightArea)" />
            <Path
              d={linePath}
              fill="none"
              stroke={colors.primary}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
            />

            {points.map((point, index) =>
              points.length <= MAX_DOTS || index === selectedIndex ? (
                <Circle
                  key={point.localDate}
                  cx={point.x + PAD.left}
                  cy={point.y + PAD.top}
                  fill={index === selectedIndex ? colors.accent : colors.surface}
                  r={index === selectedIndex ? 6 : 3.5}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              ) : null,
            )}

            <SvgText fill={colors.textMuted} fontFamily={fonts.semibold} fontSize={fontSizes.small} textAnchor="start" x={PAD.left} y={HEIGHT - 8}>
              {formatShortDate(first.localDate)}
            </SvgText>
            <SvgText fill={colors.textMuted} fontFamily={fonts.semibold} fontSize={fontSizes.small} textAnchor="end" x={width - PAD.right} y={HEIGHT - 8}>
              {formatShortDate(last.localDate)}
            </SvgText>
          </Svg>
        </View>
      </GestureDetector>

      {selected ? (
        <Animated.View
          key={selected.localDate}
          entering={fadeUp()}
          onLayout={(event) => setTooltipWidth(event.nativeEvent.layout.width)}
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              left: tooltipLeft(selected.x + PAD.left, tooltipWidth, width),
              top: Math.max(selected.y + PAD.top - 52, 0),
            },
          ]}
        >
          <Text style={styles.tooltipValue}>{selected.weightKg.toFixed(1)} kg</Text>
          <Text style={styles.tooltipDate}>{formatShortDate(selected.localDate)}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: '100%',
    },
    tooltip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      position: 'absolute',
      ...shadows.md,
    },
    tooltipValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    tooltipDate: {
      ...typography.micro,
      color: colors.textMuted,
    },
  });
}
