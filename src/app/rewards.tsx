import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components/common/AppScreen';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { ScreenTitleRow } from '../components/common/ScreenTitleRow';
import { SectionCard } from '../components/common/SectionCard';
import { ProgressionHeader } from '../components/progression/ProgressionHeader';
import { haptics } from '../services/haptics';
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
