import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { meterFillAt, MeterState } from '../../stores/trainingStore';
import { colors, layout, spacing } from '../../theme';

interface TrainingMeterProps {
  readonly meter: MeterState;
  /** Full-to-empty time (ms). */
  readonly drainMs: number;
}

/** A top-up climbs this fast before the drain resumes. */
const TOP_UP_MS = 150;
/** Quiet ticks at the quarters — one top-up each. */
const TICKS = [0.25, 0.5, 0.75];
/** Red at the empty end through amber to green at the full end. */
const RAIL_COLORS = [colors.meterLow, colors.meterMid, colors.meterHigh, colors.meterFull] as const;
const RAIL_STOPS = [0, 0.4, 0.68, 1] as const;
const LEFT = { x: 0, y: 0.5 };
const RIGHT = { x: 1, y: 0.5 };
const TRACK_HEIGHT = 14;
/** The lit leading edge of the fill. */
const HEAD_WIDTH = 3;

/**
 * The answer meter under the status strip: a game-style health rail, red at
 * the empty end and green at the full end, that drains right to left while a
 * question is open and jumps back up on every right answer. The gradient is
 * fixed to the track, so the bar loses its green first and reads red as it
 * runs low. The store owns the clock — this only draws where it stands, so the
 * bar keeps moving on the UI thread while the pad is busy.
 */
export function TrainingMeter({ meter, drainMs }: TrainingMeterProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const fill = useSharedValue(meter.fill);

  useEffect(() => {
    const current = meterFillAt(meter, drainMs, Date.now());
    cancelAnimation(fill);
    if (!meter.draining) {
      fill.value = withTiming(current, { duration: TOP_UP_MS });
      return;
    }
    fill.value = withSequence(
      withTiming(current, { duration: TOP_UP_MS }),
      withTiming(0, { duration: current * drainMs, easing: Easing.linear }),
    );
  }, [meter, drainMs, fill]);

  const clipStyle = useAnimatedStyle(
    () => ({ width: fill.value * trackWidth }),
    [trackWidth],
  );

  // The head glows in the rail's colour where the fill currently ends.
  const headStyle = useAnimatedStyle(() => {
    const tint = interpolateColor(fill.value, [...RAIL_STOPS], [...RAIL_COLORS]);
    return {
      left: Math.max(0, fill.value * trackWidth - HEAD_WIDTH),
      opacity: fill.value > 0.02 ? 1 : 0,
      shadowColor: tint,
    };
  }, [trackWidth]);

  function onLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      style={styles.track}
      onLayout={onLayout}
      accessibilityRole="progressbar"
      accessibilityLabel="Answer meter"
      // The store's last sample: where the drain (or the top-up) started from.
      accessibilityValue={{ min: 0, max: 100, now: Math.round(meter.fill * 100) }}
    >
      {/* The drained rail keeps a ghost of the colours so the run reads as a target. */}
      <LinearGradient
        colors={RAIL_COLORS}
        locations={RAIL_STOPS}
        start={LEFT}
        end={RIGHT}
        style={[StyleSheet.absoluteFill, styles.ghost]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.clip, clipStyle]} pointerEvents="none">
        <LinearGradient
          colors={RAIL_COLORS}
          locations={RAIL_STOPS}
          start={LEFT}
          end={RIGHT}
          style={[styles.rail, { width: trackWidth }]}
        />
        <View style={styles.sheen} />
        <View style={styles.shade} />
      </Animated.View>
      <Animated.View style={[styles.head, headStyle]} pointerEvents="none" />
      {TICKS.map((tick) => (
        <View key={tick} style={[styles.tick, { left: `${tick * 100}%` }]} pointerEvents="none" />
      ))}
      <View style={styles.bezel} pointerEvents="none" />
    </View>
  );
}

/** Track plus its top margin: the felt below drops by this much once the meter is out. */
export const TRAINING_METER_HEIGHT = TRACK_HEIGHT + spacing.sm;

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.sm,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.overlay,
    overflow: 'hidden',
    shadowColor: colors.chipShadow,
    shadowOpacity: 1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  ghost: {
    opacity: 0.16,
  },
  clip: {
    height: '100%',
    overflow: 'hidden',
  },
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  /** A lit upper half so the bar reads as a glossy, solid rail. */
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  /** A shaded lower edge for the same reason. */
  shade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '25%',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  head: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    width: HEAD_WIDTH,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  /** Gold rim drawn last so the fill never paints over it. */
  bezel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
});
