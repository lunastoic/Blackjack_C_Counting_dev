import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

interface QuizStreakMeterProps {
  readonly streak: number;
  readonly target: number;
}

/**
 * Nine-segment streak meter. Filled circles glow gold, the next empty circle
 * pulses to draw the eye, and a new fill animates with a small pop.
 */
export function QuizStreakMeter({ streak, target }: QuizStreakMeterProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      true,
    );
  }, [reducedMotion, pulse]);

  return (
    <View style={styles.container}>
      <View style={styles.row} accessibilityLabel={`Streak ${streak} of ${target}`}>
        {Array.from({ length: target }, (_, i) => {
          const filled = i < streak;
          const isNext = i === streak && streak < target;
          return (
            <View key={i} style={styles.dotWrap}>
              <Animated.View
                style={[
                  styles.dot,
                  filled && styles.dotFilled,
                  isNext && { transform: [{ scale: pulse }] },
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text style={styles.label}>
        {streak === 0
          ? 'Fill the circles for the grand prize'
          : streak >= target
            ? 'GRAND PRIZE READY'
            : `${streak} correct — ${target - streak} to go`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dotWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.goldDim,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
