import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

export interface QuizRank {
  readonly title: string;
  readonly subtitle: string;
  readonly color: string;
}

const RANKS: QuizRank[] = [
  { title: 'New Shoe', subtitle: 'Warm-up round', color: colors.textMuted },
  { title: 'Apprentice', subtitle: 'Finding the rhythm', color: colors.textSecondary },
  { title: 'Apprentice', subtitle: 'Finding the rhythm', color: colors.textSecondary },
  { title: 'Card Sharp', subtitle: 'Decoys incoming', color: colors.goldDim },
  { title: 'Card Sharp', subtitle: 'Decoys incoming', color: colors.goldDim },
  { title: 'Card Sharp', subtitle: 'Decoys incoming', color: colors.goldDim },
  { title: 'Counter', subtitle: 'Speed rising', color: colors.gold },
  { title: 'Counter', subtitle: 'Speed rising', color: colors.gold },
  { title: 'Ace Counter', subtitle: 'Pairs & pressure', color: colors.goldBright },
  { title: 'High Roller', subtitle: 'Grand prize ready', color: colors.success },
];

export function quizRankForStreak(streak: number): QuizRank {
  const index = Math.max(0, Math.min(RANKS.length - 1, streak));
  return RANKS[index];
}

interface QuizMilestoneBadgeProps {
  readonly streak: number;
}

/**
 * A casino-themed rank badge that pops whenever the player climbs a streak
 * tier. Adds personality to the difficulty ramp without touching the rules.
 */
export function QuizMilestoneBadge({ streak }: QuizMilestoneBadgeProps) {
  const reducedMotion = useReducedMotion();
  const rank = quizRankForStreak(streak);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withTiming(1.12, { duration: 120 }),
      withTiming(1, { duration: 180 }),
    );
  }, [streak, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.badge, animatedStyle]}>
      <View style={[styles.rankDot, { backgroundColor: rank.color }]} />
      <View>
        <Text style={[styles.title, { color: rank.color }]}>{rank.title}</Text>
        <Text style={styles.subtitle}>{rank.subtitle}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rankDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: fontSizes.caption,
    color: colors.textMuted,
  },
});
