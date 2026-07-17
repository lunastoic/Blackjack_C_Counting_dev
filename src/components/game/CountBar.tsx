import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, durations, fontSizes, fontWeights, radii, spacing } from '../../theme';

/** The visual meter clamps to ±10 (the stored count itself is never clamped). */
const METER_RANGE = 10;
const BADGE_SIZE = 26;

function countColor(value: number): string {
  if (value > 0) {
    return colors.trainingPlus;
  }
  if (value < 0) {
    return colors.trainingMinus;
  }
  return colors.trainingNeutral;
}

/** Gradient running-count meter (red → yellow → green) with a sliding badge. */
function CountMeter({ runningCount }: { runningCount: number }) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const position = useSharedValue(0.5);

  const clamped = Math.max(-METER_RANGE, Math.min(METER_RANGE, runningCount));
  const fraction = (clamped + METER_RANGE) / (METER_RANGE * 2);

  useEffect(() => {
    position.value = reducedMotion
      ? fraction
      : withTiming(fraction, { duration: durations.normal });
  }, [fraction, reducedMotion, position]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * Math.max(0, trackWidth - BADGE_SIZE) }],
  }));

  function onLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      style={styles.meterTrack}
      onLayout={onLayout}
      accessibilityLabel={`Count meter at ${runningCount}`}
    >
      <LinearGradient
        colors={[colors.trainingMinus, '#E0B94D', colors.trainingPlus]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.meterGradient}
      />
      <Animated.View style={[styles.meterBadge, badgeStyle]}>
        <Text style={styles.meterBadgeText}>
          {runningCount > 0 ? `+${clamped}` : clamped}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Centered training stats: running count, true count, cards left, shuffle notices. */
export function CountStatsBar() {
  const runningCount = useGameSessionStore((state) => state.runningCount);
  const shufflePending = useGameSessionStore((state) => state.shufflePending);
  const justShuffled = useGameSessionStore((state) => state.justShuffled);
  const remaining = useGameSessionStore((state) => state.getCardsRemainingVisible());
  const trueCountValue = useGameSessionStore((state) => state.getTrueCount());

  const runningLabel = runningCount > 0 ? `+${runningCount}` : `${runningCount}`;
  const trueLabel = trueCountValue > 0 ? `+${trueCountValue}` : `${trueCountValue}`;

  return (
    <View style={styles.container}>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>RUNNING</Text>
          <Text style={[styles.statValue, { color: countColor(runningCount) }]}>
            {runningLabel}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>TRUE</Text>
          <Text style={[styles.statValue, { color: countColor(trueCountValue) }]}>
            {trueLabel}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>CARDS LEFT</Text>
          <Text style={styles.statValue}>{remaining}</Text>
        </View>
      </View>
      {justShuffled ? (
        <Text style={styles.shuffleNotice}>Shuffled — count reset to 0</Text>
      ) : shufflePending ? (
        <Text style={styles.shuffleWarning}>Shuffling deck after this round</Text>
      ) : null}
    </View>
  );
}

/** Training-mode count strip: horizontal meter + stats (legacy / settings previews). */
export function CountBar() {
  const runningCount = useGameSessionStore((state) => state.runningCount);

  return (
    <View style={styles.container}>
      <CountMeter runningCount={runningCount} />
      <CountStatsBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  meterTrack: {
    height: BADGE_SIZE,
    justifyContent: 'center',
  },
  meterGradient: {
    height: 10,
    borderRadius: radii.pill,
    opacity: 0.85,
  },
  meterBadge: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterBadgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  stats: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: spacing.sm,
    backgroundColor: colors.overlayLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    maxWidth: '100%',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  shuffleWarning: {
    color: colors.warning,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  shuffleNotice: {
    color: colors.success,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
});
