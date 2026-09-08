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
/** The fill turns from gold to red as it empties. */
const WARN_FILL = 0.35;
/** Quiet ticks at the quarters — one top-up each. */
const TICKS = [0.25, 0.5, 0.75];

/**
 * The answer meter under the status strip: a gold bar that drains right to
 * left while a question is open, jumps up on every right answer, and reads
 * red as it runs low. The store owns the clock — this only draws where it
 * stands, so the bar keeps moving on the UI thread while the pad is busy.
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

  const fillStyle = useAnimatedStyle(
    () => ({
      width: fill.value * trackWidth,
      backgroundColor: interpolateColor(
        fill.value,
        [0, WARN_FILL, 1],
        [colors.error, colors.error, colors.goldBright],
      ),
    }),
    [trackWidth],
  );

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
      <Animated.View style={[styles.fill, fillStyle]}>
        <View style={styles.sheen} pointerEvents="none" />
      </Animated.View>
      {TICKS.map((tick) => (
        <View key={tick} style={[styles.tick, { left: `${tick * 100}%` }]} pointerEvents="none" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 14,
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.sm,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlay,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  /** A lighter upper half so the bar reads as a solid, lit rail. */
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
});
