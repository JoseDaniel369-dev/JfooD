import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { buildBars, type BarInput } from '@/features/progress/utils/bars';
import { radius, spacing, typography, useTheme, type ThemeColors, fontSizes } from '@/theme';

interface BarChartProps {
  data: readonly BarInput[];
  /** Draws a dashed line at this value (e.g. the calorie goal). */
  goal?: number | null;
  height?: number;
  /** Text shown under the first and last bar. */
  startLabel?: string;
  endLabel?: string;
  accessibilityLabel: string;
}

/** Bars over time with an optional goal line. Orange bars are minimums (missing data). */
export function BarChart({
  data,
  goal = null,
  height = 140,
  startLabel,
  endLabel,
  accessibilityLabel,
}: BarChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);

  const layout = useMemo(() => buildBars(data, goal, width, height), [data, goal, width, height]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}
    >
      {width > 0 ? (
        <Svg height={height} width={width}>
          {layout.bars.map((bar, index) => (
            <Rect
              key={index}
              fill={
                bar.kind === 'empty'
                  ? colors.surfaceMuted
                  : bar.kind === 'approximate'
                    ? colors.accent
                    : colors.primaryBright
              }
              height={bar.height}
              rx={Math.min(radius.sm, bar.width / 2)}
              width={bar.width}
              x={bar.x}
              y={bar.y}
            />
          ))}
          {layout.goalY !== null ? (
            <Line
              stroke={colors.textMuted}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              x1={0}
              x2={width}
              y1={layout.goalY}
              y2={layout.goalY}
            />
          ) : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      {startLabel || endLabel ? (
        <View style={styles.labels}>
          <Text style={styles.label}>{startLabel}</Text>
          <Text style={styles.label}>{endLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    labels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    label: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: fontSizes.small,
    },
  });
}
