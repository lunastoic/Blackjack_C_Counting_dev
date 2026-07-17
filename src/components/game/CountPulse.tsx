import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors, layers } from '../../theme';

/**
 * Optional training aid: a brief full-screen color flash for every count
 * change (green +, red −). Zero-value cards do not change the count, so they
 * produce no pulse. Disabled automatically under reduced motion.
 */
export function CountPulse() {
  const enabled = useSettingsStore((state) => state.trainingAids.countPulse);
  const runningCount = useGameSessionStore((state) => state.runningCount);
  const reducedMotion = useReducedMotion();

  const opacity = useSharedValue(0);
  const color = useSharedValue<string>(colors.trainingNeutral);
  const previous = useRef(runningCount);

  useEffect(() => {
    const delta = runningCount - previous.current;
    previous.current = runningCount;
    if (!enabled || reducedMotion || delta === 0) {
      return;
    }
    color.value = delta > 0 ? colors.trainingPlus : colors.trainingMinus;
    opacity.value = withSequence(
      withTiming(0.22, { duration: 90 }),
      withTiming(0, { duration: 260 }),
    );
  }, [runningCount, enabled, reducedMotion, opacity, color]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: color.value,
  }));

  return <Animated.View pointerEvents="none" style={[styles.overlay, style]} />;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: layers.toast,
  },
});
