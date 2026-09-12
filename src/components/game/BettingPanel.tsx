import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isValidBet } from '../../engine/betting/bets';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useEconomyStore } from '../../stores/economyStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { ArcadeButton, ArcadeInfoBox, arcadeShadow } from '../arcade';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { ChipTray } from './ChipTray';

/** Betting phase controls: chip tray, Return / Redo / Deal (pile lives on the felt). */
export function BettingPanel() {
  const map = useGameSessionStore((state) => state.map);
  const wager = useGameSessionStore((state) => state.wager);
  const returnBet = useGameSessionStore((state) => state.returnBet);
  const redoBet = useGameSessionStore((state) => state.redoBet);
  const deal = useGameSessionStore((state) => state.deal);
  const chips = useEconomyStore((state) => state.chips);
  const lastBet = useEconomyStore((state) => state.lastBet);
  const modern = useModernUi();

  if (!map) {
    return null;
  }

  const canDeal = isValidBet(wager, map.maxBet);
  const canRedo = lastBet > 0 && lastBet !== wager && lastBet <= chips + wager && lastBet <= map.maxBet;

  // Broke rescue: no chips anywhere → offer the daily / broke reward inline.
  if (chips === 0 && wager === 0) {
    const economy = useEconomyStore.getState();
    const dailyAvailable = economy.isDailyRewardAvailable();
    const brokeAvailable = economy.isBrokeRewardAvailable();
    const claimDaily = () => {
      if (useEconomyStore.getState().claimDailyReward()) {
        void haptics.success();
      }
    };
    const claimBroke = () => {
      if (useEconomyStore.getState().claimBrokeReward()) {
        void haptics.success();
      }
    };
    if (modern) {
      return (
        <View style={[styles.panel, styles.panelModern]}>
          <View style={styles.brokeCardModern}>
            <Text style={styles.brokeTitleModern}>OUT OF CHIPS</Text>
            {dailyAvailable ? (
              <ArcadeButton label="Claim daily reward" onPress={claimDaily} style={styles.brokeButtonModern} />
            ) : brokeAvailable ? (
              <ArcadeButton label="Claim rescue chips" onPress={claimBroke} style={styles.brokeButtonModern} />
            ) : (
              <ArcadeInfoBox>Check the Rewards screen for your next free chips.</ArcadeInfoBox>
            )}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.panel}>
        <View style={styles.brokeCard}>
          <Text style={styles.brokeTitle}>Out of chips</Text>
          {dailyAvailable ? (
            <PrimaryButton label="Claim daily reward" onPress={claimDaily} />
          ) : brokeAvailable ? (
            <PrimaryButton label="Claim rescue chips" onPress={claimBroke} />
          ) : (
            <Text style={styles.brokeHint}>
              Check the Rewards screen for your next free chips.
            </Text>
          )}
        </View>
      </View>
    );
  }

  const onDeal = () => {
    if (deal()) {
      playSound('betPlaced');
      void haptics.mediumTap();
    }
  };

  if (modern) {
    return (
      <View style={[styles.panel, styles.panelModern]}>
        <ChipTray />

        <View style={styles.buttonRow}>
          <ArcadeButton
            label="Return"
            variant="neutral"
            onPress={returnBet}
            disabled={wager === 0}
            style={styles.sideButtonModern}
            accessibilityHint="Return all chips from the bet to your bankroll"
          />
          <ArcadeButton
            label="Deal"
            onPress={onDeal}
            disabled={!canDeal}
            style={styles.dealButtonModern}
          />
          <ArcadeButton
            label="Redo"
            variant="neutral"
            onPress={redoBet}
            disabled={!canRedo}
            style={styles.sideButtonModern}
            accessibilityHint="Repeat your previous bet"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <ChipTray />

      <View style={styles.buttonRow}>
        <SecondaryButton
          label="Return"
          onPress={returnBet}
          disabled={wager === 0}
          style={styles.sideButton}
          accessibilityHint="Return all chips from the bet to your bankroll"
        />
        <PrimaryButton
          label="Deal"
          onPress={onDeal}
          disabled={!canDeal}
          style={styles.dealButton}
        />
        <SecondaryButton
          label="Redo"
          onPress={redoBet}
          disabled={!canRedo}
          style={styles.sideButton}
          accessibilityHint="Repeat your previous bet"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sideButton: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  dealButton: {
    flex: 1.4,
    borderRadius: radii.md,
  },
  /* Modern */
  panelModern: {
    gap: spacing.sm + spacing.xxs,
  },
  sideButtonModern: {
    flex: 1,
  },
  dealButtonModern: {
    flex: 1.4,
  },
  brokeCardModern: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  brokeTitleModern: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 2,
    color: colors.arcadeGold,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  brokeButtonModern: {
    alignSelf: 'stretch',
  },
  brokeCard: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.overlayLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    padding: spacing.lg,
  },
  brokeTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  brokeHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
  },
});
