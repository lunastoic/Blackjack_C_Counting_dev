import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { HandResult } from '../../engine/blackjack/resolve';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, layers, radii, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';

const RESULT_TEXT: Record<HandResult, string> = {
  blackjack: 'BLACKJACK!',
  win: 'YOU WIN',
  push: 'PUSH',
  loss: 'DEALER WINS',
};

const RESULT_COLOR: Record<HandResult, string> = {
  blackjack: colors.goldBright,
  win: colors.success,
  push: colors.trainingNeutral,
  loss: colors.error,
};

/** Result banner shown during the payout phase (both hands when split). */
export function PayoutBanner() {
  const phase = useGameSessionStore((state) => state.phase);
  const payout = useGameSessionStore((state) => state.payout);
  const xpAwarded = useGameSessionStore((state) => state.xpAwarded);
  const reducedMotion = useReducedMotion();

  const active = phase === 'payout' && payout !== null;
  const totalProfit = payout?.totalProfit ?? 0;

  useEffect(() => {
    if (!active) {
      return;
    }
    if (totalProfit > 0) {
      playSound('win');
      void haptics.success();
    } else if (totalProfit < 0) {
      playSound('loss');
      void haptics.warning();
    } else {
      playSound('push');
      void haptics.lightTap();
    }
  }, [active, totalProfit]);

  if (!active || !payout) {
    return null;
  }

  const single = payout.hands.length === 1;
  const headline = single
    ? RESULT_TEXT[payout.hands[0].result]
    : payout.totalProfit > 0
      ? 'YOU WIN'
      : payout.totalProfit < 0
        ? 'DEALER WINS'
        : 'PUSH';
  const headlineColor = single
    ? RESULT_COLOR[payout.hands[0].result]
    : payout.totalProfit > 0
      ? colors.success
      : payout.totalProfit < 0
        ? colors.error
        : colors.trainingNeutral;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(250)}
      exiting={reducedMotion ? undefined : FadeOut.duration(200)}
      style={styles.wrapper}
      pointerEvents="none"
    >
      <View style={styles.banner}>
        <Text style={[styles.headline, { color: headlineColor }]}>{headline}</Text>
        {!single
          ? payout.hands.map((hand, index) => (
              <Text key={hand.handId} style={styles.handLine}>
                Hand {index + 1}: {RESULT_TEXT[hand.result]}{' '}
                {hand.profit > 0 ? `+${formatChips(hand.profit)}` : formatChips(hand.profit)}
              </Text>
            ))
          : null}
        <Text style={styles.profit}>
          {payout.totalProfit > 0
            ? `+${formatChips(payout.totalProfit)} chips`
            : payout.totalProfit < 0
              ? `${formatChips(payout.totalProfit)} chips`
              : 'Bet returned'}
        </Text>
        {xpAwarded > 0 ? <Text style={styles.xp}>+{xpAwarded} XP</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: layers.overlay,
  },
  banner: {
    minWidth: 240,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.overlay,
  },
  headline: {
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
  },
  handLine: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontVariant: ['tabular-nums'],
  },
  profit: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  xp: {
    color: colors.gold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
});
