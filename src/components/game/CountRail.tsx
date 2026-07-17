import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, durations, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';

/** Visual meter clamps to ±10; stored count is never clamped. */
const METER_RANGE = 10;
const BAR_WIDTH = 10;
const RAIL_WIDTH = 58;
const INDICATOR_HEIGHT = 24;
const MIN_RAIL_HEIGHT = 220;
const MAX_RAIL_HEIGHT = 280;

/** Horizontal space the count rail occupies (padding + bar + value tag). */
export const COUNT_RAIL_CLEARANCE = layout.screenPaddingH + RAIL_WIDTH;

const METER_GREEN = colors.trainingPlus;
const METER_MID = '#E0B94D';
const METER_RED = colors.trainingMinus;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function lerpColor(from: string, to: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const t = Math.min(1, Math.max(0, amount));
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Matches the vertical meter gradient at the indicator position. */
function meterColorAtRatio(ratio: number): string {
  if (ratio <= 0.5) {
    return lerpColor(METER_GREEN, METER_MID, ratio / 0.5);
  }
  return lerpColor(METER_MID, METER_RED, (ratio - 0.5) / 0.5);
}

function meterColorForCount(runningCount: number): string {
  return meterColorAtRatio(countToYRatio(runningCount));
}

function countToYRatio(runningCount: number): number {
  const clamped = Math.max(-METER_RANGE, Math.min(METER_RANGE, runningCount));
  return (METER_RANGE - clamped) / (METER_RANGE * 2);
}

function formatCountLabel(runningCount: number): string {
  return runningCount > 0 ? `+${runningCount}` : `${runningCount}`;
}

function VerticalCountMeter({
  runningCount,
  railHeight,
}: {
  runningCount: number;
  railHeight: number;
}) {
  const reducedMotion = useReducedMotion();
  const trackHeight = useSharedValue(railHeight);
  const yRatio = useSharedValue(countToYRatio(runningCount));

  useEffect(() => {
    trackHeight.value = railHeight;
  }, [railHeight, trackHeight]);

  useEffect(() => {
    const target = countToYRatio(runningCount);
    yRatio.value = reducedMotion
      ? target
      : withTiming(target, { duration: durations.normal });
  }, [runningCount, reducedMotion, yRatio]);

  const indicatorStyle = useAnimatedStyle(() => {
    const centerY = yRatio.value * trackHeight.value;
    const top = Math.min(
      Math.max(centerY - INDICATOR_HEIGHT / 2, 0),
      Math.max(0, trackHeight.value - INDICATOR_HEIGHT),
    );
    return { top };
  });

  const label = formatCountLabel(runningCount);
  const meterColor = meterColorForCount(runningCount);

  return (
    <View
      style={[styles.meterTrack, { height: railHeight }]}
      accessibilityLabel={`Count meter at ${runningCount}`}
    >
      <LinearGradient
        colors={[colors.trainingPlus, '#E0B94D', colors.trainingMinus]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.meterGradient}
      />
      <View style={styles.centerTick} pointerEvents="none" />
      <Text style={[styles.poleLabel, styles.poleTop]}>+{METER_RANGE}</Text>
      <Text style={[styles.poleLabel, styles.poleBottom]}>−{METER_RANGE}</Text>

      <Animated.View style={[styles.indicatorRow, indicatorStyle]}>
        <View style={[styles.tickBar, { backgroundColor: meterColor, shadowColor: meterColor }]} />
        <View style={[styles.valueTag, { borderColor: `${meterColor}AA` }]}>
          <Text style={[styles.valueText, { color: meterColor }]}>{label}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** Vertical running-count meter, centered along the left edge of the table. */
export function CountRail() {
  const runningCount = useGameSessionStore((state) => state.runningCount);
  const { height: windowHeight } = useWindowDimensions();
  const railHeight = Math.min(MAX_RAIL_HEIGHT, Math.max(MIN_RAIL_HEIGHT, windowHeight * 0.36));

  return (
    <View style={styles.rail} pointerEvents="none">
      <VerticalCountMeter runningCount={runningCount} railHeight={railHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: layout.screenPaddingH,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  meterTrack: {
    width: RAIL_WIDTH,
  },
  meterGradient: {
    position: 'absolute',
    left: 0,
    width: BAR_WIDTH,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
    opacity: 0.92,
  },
  centerTick: {
    position: 'absolute',
    left: -3,
    top: '50%',
    marginTop: -1,
    width: BAR_WIDTH + 6,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1,
  },
  poleLabel: {
    position: 'absolute',
    left: 0,
    width: BAR_WIDTH,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  poleTop: {
    top: -2,
  },
  poleBottom: {
    bottom: -2,
  },
  indicatorRow: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: INDICATOR_HEIGHT,
    gap: spacing.xs,
    zIndex: 1,
  },
  tickBar: {
    width: BAR_WIDTH + 6,
    height: 4,
    marginLeft: -3,
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  valueTag: {
    minWidth: 34,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(12, 10, 9, 0.88)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    lineHeight: fontSizes.subtitle,
  },
});
