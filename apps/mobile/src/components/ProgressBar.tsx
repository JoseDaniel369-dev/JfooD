import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

interface ProgressBarProps {
  value: number | null;
  maximum: number;
  color?: string;
  trackColor?: string;
}

export function ProgressBar({
  value,
  maximum,
  color = colors.primary,
  trackColor = colors.surfaceMuted,
}: ProgressBarProps) {
  const progress =
    value === null || maximum <= 0
      ? 0
      : Math.min(Math.max(value / maximum, 0), 1);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: maximum, now: value ?? 0 }}
      style={[styles.track, { backgroundColor: trackColor }]}
    >
      <View
        style={[
          styles.fill,
          { backgroundColor: color, width: `${progress * 100}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    height: 7,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.pill,
    height: '100%',
  },
});
