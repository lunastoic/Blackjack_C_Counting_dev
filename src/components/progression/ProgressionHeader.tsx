import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MAX_LEVEL, XP_PER_LEVEL } from '../../engine/progression/progression';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { colors, durations, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { ProgressBar } from '../common/ProgressBar';

/**
 * Persistent header: chip balance, level badge, XP progress toward the next
 * level. Reused on Home, Maps, Settings, Rewards, Achievements, How to Play,
 * and future gameplay screens.
 */
export function ProgressionHeader() {
  const chips = useEconomyStore((state) => state.chips);
  const level = useProgressionStore((state) => state.level);
  const xpIntoLevel = useProgressionStore((state) => state.xpIntoLevel);
  const reducedMotion = useReducedMotion();

  const atMaxLevel = level >= MAX_LEVEL;
  const xpProgress = atMaxLevel ? 1 : xpIntoLevel / XP_PER_LEVEL;

  const chipScale = useSharedValue(1);
  const badgeScale = useSharedValue(1);
  const previousChips = useRef(chips);
  const previousLevel = useRef(level);

  useEffect(() => {
    if (previousChips.current !== chips && !reducedMotion) {
      chipScale.value = withSequence(
        withTiming(1.12, { duration: durations.fast }),
        withTiming(1, { duration: durations.normal }),
      );
    }
    previousChips.current = chips;
  }, [chips, reducedMotion, chipScale]);

  useEffect(() => {
    if (previousLevel.current !== level && !reducedMotion) {
      badgeScale.value = withSequence(
        withTiming(1.2, { duration: durations.normal }),
        withTiming(1, { duration: durations.slow }),
      );
    }
    previousLevel.current = level;
  }, [level, reducedMotion, badgeScale]);

  const chipStyle = useAnimatedStyle(() => ({ transform: [{ scale: chipScale.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  return (
    <View style={styles.container} accessibilityRole="header">
      <Animated.View style={[styles.chipPill, chipStyle]}>
        <View style={styles.chipDot} />
        <Text style={styles.chipText} accessibilityLabel={`${chips} chips`}>
          {formatChips(chips)}
        </Text>
      </Animated.View>

      <View style={styles.xpSection}>
        <ProgressBar
          progress={xpProgress}
          height={6}
          accessibilityLabel={
            atMaxLevel ? 'Maximum level reached' : `${xpIntoLevel} of ${XP_PER_LEVEL} XP`
          }
        />
        <Text style={styles.xpText}>
          {atMaxLevel ? 'MAX LEVEL' : `${xpIntoLevel} / ${XP_PER_LEVEL} XP`}
        </Text>
      </View>

      <Animated.View style={[styles.levelBadge, badgeStyle]}>
        <Text style={styles.levelLabel}>LVL</Text>
        <Text style={styles.levelValue}>{level}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.goldDim,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  xpSection: {
    flex: 1,
    gap: spacing.xs,
  },
  xpText: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  levelBadge: {
    minWidth: layout.touchTarget,
    alignItems: 'center',
    backgroundColor: colors.burgundy,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  levelLabel: {
    color: colors.goldBright,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  levelValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
});
