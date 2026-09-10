import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components/common/AppScreen';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { ProgressBar } from '../components/common/ProgressBar';
import { ScreenTitleRow } from '../components/common/ScreenTitleRow';
import { SectionCard } from '../components/common/SectionCard';
import { ProgressionHeader } from '../components/progression/ProgressionHeader';
import { DAILY_GOAL_STREAK_CAP, dailyGoalMultiplier } from '../engine/dojo/dailyGoal';
import { haptics } from '../services/haptics';
import { useDailyGoalStore } from '../stores/dailyGoalStore';
import {
  BROKE_REWARD_CHIPS,
  DAILY_REWARD_CHIPS,
  useEconomyStore,
} from '../stores/economyStore';
import { colors, fontSizes, fontWeights, spacing } from '../theme';
import { formatChips, formatCountdown } from '../utils/format';

export default function RewardsScreen() {
  const economy = useEconomyStore();
  // Tick each second so the countdown stays live while this screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dailyAvailable = economy.isDailyRewardAvailable(now);
  const msRemaining = economy.dailyRewardMsRemaining(now);
  const brokeAvailable = economy.isBrokeRewardAvailable(now);

  const dailyGoal = useDailyGoalStore();
  const goal = dailyGoal.goal(now);
  const goalProgress = Math.min(dailyGoal.progressToday(now), goal.target);
  const goalClaimed = dailyGoal.isClaimed(now);
  const goalClaimable = dailyGoal.isClaimable(now);
  const goalReward = dailyGoal.rewardToday(now);
  const streak = dailyGoal.streakToday(now);
  // The streak a claim today lands on — what the multiplier shows.
  const streakShown = goalClaimed ? streak : streak + 1;

  function handleClaimGoal() {
    if (dailyGoal.claim(now) > 0) {
      void haptics.success();
    }
  }

  function handleClaimDaily() {
    if (economy.claimDailyReward()) {
      void haptics.success();
    }
  }

  function handleClaimBroke() {
    if (economy.claimBrokeReward()) {
      void haptics.success();
    }
  }

  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="Rewards" />
      <View style={styles.stack}>
        <SectionCard title="Daily goal">
          <Text style={styles.goalTitle}>{goal.title}</Text>
          <Text style={styles.rewardDescription}>{goal.hint}</Text>
          <View style={styles.goalProgressRow}>
            <ProgressBar
              progress={goalProgress / goal.target}
              height={10}
              fillColor={goalClaimed ? colors.success : colors.gold}
              style={styles.goalBar}
              accessibilityLabel={`${goalProgress} of ${goal.target}`}
            />
            <Text style={styles.goalCount}>
              {goalProgress}/{goal.target}
            </Text>
          </View>
          <View style={styles.goalMetaRow}>
            <Text style={styles.goalReward}>{formatChips(goalReward)} chips</Text>
            <Text style={styles.goalStreak}>
              🔥 {streakShown}-day streak · ×{dailyGoalMultiplier(streakShown).toFixed(2)}
            </Text>
          </View>
          <Text style={styles.goalStreakHint}>
            {streakShown >= DAILY_GOAL_STREAK_CAP
              ? 'Max streak pay-out. Missing a day resets it.'
              : `Pays more each day in a row, up to 2× at ${DAILY_GOAL_STREAK_CAP}. Missing a day resets the streak.`}
          </Text>
          {goalClaimed ? (
            <Text style={styles.unavailableText}>Claimed today — a new goal lands tomorrow.</Text>
          ) : goalClaimable ? (
            <PrimaryButton
              label={`Claim ${formatChips(goalReward)} chips`}
              onPress={handleClaimGoal}
              style={styles.claimButton}
            />
          ) : null}
        </SectionCard>

        <SectionCard title="Daily bonus">
          <Text style={styles.rewardAmount}>{formatChips(DAILY_REWARD_CHIPS)} chips</Text>
          <Text style={styles.rewardDescription}>
            Claim a free chip bonus once every 24 hours.
          </Text>
          {dailyAvailable ? (
            <PrimaryButton
              label="Claim Daily Bonus"
              onPress={handleClaimDaily}
              style={styles.claimButton}
            />
          ) : (
            <View style={styles.countdownBox}>
              <Text style={styles.countdownLabel}>Next bonus in</Text>
              <Text style={styles.countdownValue}>{formatCountdown(msRemaining)}</Text>
            </View>
          )}
        </SectionCard>

        <SectionCard title="Emergency chips">
          <Text style={styles.rewardAmount}>{formatChips(BROKE_REWARD_CHIPS)} chips</Text>
          <Text style={styles.rewardDescription}>
            Out of chips while the daily bonus is on cooldown? Watch a short break to get back in
            the game.
          </Text>
          {brokeAvailable ? (
            <PrimaryButton
              label="Get Emergency Chips"
              onPress={handleClaimBroke}
              style={styles.claimButton}
            />
          ) : (
            <Text style={styles.unavailableText}>
              {economy.chips > 0
                ? 'Available only when your balance reaches zero.'
                : 'Available once the daily bonus is on cooldown.'}
            </Text>
          )}
        </SectionCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  rewardAmount: {
    color: colors.goldBright,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    marginBottom: spacing.xs,
  },
  goalTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    marginBottom: spacing.xs,
  },
  goalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  goalBar: {
    flex: 1,
  },
  goalCount: {
    color: colors.textPrimary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'right',
  },
  goalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  goalReward: {
    color: colors.goldBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
  },
  goalStreak: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
  goalStreakHint: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  rewardDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  claimButton: {
    alignSelf: 'stretch',
  },
  countdownBox: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  countdownLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  countdownValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  unavailableText: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontStyle: 'italic',
  },
});
