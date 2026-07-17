import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, durations, radii } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ProgressBarProps {
  /** 0..1 */
  readonly progress: number;
  readonly height?: number;
  readonly fillColor?: string;
  readonly trackColor?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}

/** Animated determinate progress bar (jumps instantly under reduced motion). */
export function ProgressBar({
  progress,
  height = 8,
  fillColor = colors.gold,
  trackColor = colors.surfaceRaised,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const animated = useSharedValue(clamped);

  useEffect(() => {
    animated.value = reducedMotion
      ? clamped
      : withTiming(clamped, { duration: durations.slow });
  }, [clamped, reducedMotion, animated]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${animated.value * 100}%`,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }, style]}
    >
      <Animated.View
        style={[styles.fill, { borderRadius: height / 2, backgroundColor: fillColor }, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.pill,
  },
  fill: {
    height: '100%',
  },
});
