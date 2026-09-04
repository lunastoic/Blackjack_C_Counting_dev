import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';

interface QuizStreakMeterProps {
  readonly streak: number;
  readonly target: number;
  /** Streak values a miss falls back to — drawn as dividers in the meter. */
  readonly checkpoints?: readonly number[];
}

interface MeterDotProps {
  readonly filled: boolean;
  readonly isNext: boolean;
  readonly pulse: SharedValue<number>;
}

function MeterDot({ filled, isNext, pulse }: MeterDotProps) {
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: isNext ? pulse.value : 1 }],
    }),
    [isNext, pulse],
  );

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dot, filled && styles.dotFilled, animatedStyle]} />
    </View>
  );
}

/**
 * Nine-segment streak meter. Filled circles glow gold, the next empty circle
 * pulses to draw the eye, and thin dividers mark the checkpoint floors a
 * miss falls back to.
 */
export function QuizStreakMeter({ streak, target, checkpoints = [] }: QuizStreakMeterProps) {
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
            <React.Fragment key={i}>
              {checkpoints.includes(i) ? <View style={styles.checkpointDivider} /> : null}
              <MeterDot filled={filled} isNext={isNext} pulse={pulse} />
            </React.Fragment>
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
  checkpointDivider: {
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: colors.goldDim,
    alignSelf: 'center',
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
