import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { HandResult } from '../../engine/blackjack/resolve';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fonts, fontSizes, fontWeights, layers, radii, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { ArcadePanel, arcadeShadow } from '../arcade';
import { ModernPlaque } from './ModernPlaque';

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

/** The Modern plaque: blackjack keeps the plaque's gold, the rest tint. */
const MODERN_RESULT_COLOR: Record<HandResult, string> = {
  blackjack: colors.arcadeGold,
  win: colors.arcadeMint,
  push: colors.arcadeMuted,
  loss: colors.arcadeLoss,
};

/** The Modern stack's width — the toast above the banner shares it. */
const MODERN_STACK_WIDTH = 300;

interface PayoutBannerProps {
  /**
   * Anything stacked directly above the banner — the Modern look parks the
   * book-play toast there so it never covers the result.
   */
  readonly above?: React.ReactNode;
}

/** Result banner shown during the payout phase (both hands when split). */
export function PayoutBanner({ above }: PayoutBannerProps = {}) {
  const phase = useGameSessionStore((state) => state.phase);
  const payout = useGameSessionStore((state) => state.payout);
  const xpAwarded = useGameSessionStore((state) => state.xpAwarded);
  const reducedMotion = useReducedMotion();
  const modern = useModernUi();

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

  if (modern) {
    const outcome: HandResult = single
      ? payout.hands[0].result
      : payout.totalProfit > 0
        ? 'win'
        : payout.totalProfit < 0
          ? 'loss'
          : 'push';
    const modernHeadline =
      outcome === 'blackjack'
        ? 'Blackjack!'
        : outcome === 'win'
          ? 'You win'
          : outcome === 'loss'
            ? 'Dealer wins'
            : 'Push';
    const chipsLine =
      payout.totalProfit > 0
        ? `+${formatChips(payout.totalProfit)} chips`
        : payout.totalProfit < 0
          ? `${formatChips(payout.totalProfit)} chips`
          : `${formatChips(payout.totalReturned)} chips back`;
    const tint = MODERN_RESULT_COLOR[outcome];
    // The chips line reads by sign — a blackjack's gold plaque still pays in mint.
    const chipsTint =
      payout.totalProfit > 0
        ? colors.arcadeMint
        : payout.totalProfit < 0
          ? colors.arcadeLoss
          : colors.arcadeMuted;
    return (
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(250)}
        exiting={reducedMotion ? undefined : FadeOut.duration(200)}
        style={[styles.wrapper, styles.wrapperModern]}
        pointerEvents="box-none"
      >
        <View style={styles.stackModern} pointerEvents="box-none">
          {above}
          <ArcadePanel style={styles.bannerModern}>
            <ModernPlaque tab="Hand over" title={modernHeadline} color={tint} />
            {!single
              ? payout.hands.map((hand, index) => (
                  <Text key={hand.handId} style={styles.handLineModern}>
                    Hand {index + 1}: {RESULT_TEXT[hand.result]}{' '}
                    {hand.profit > 0 ? `+${formatChips(hand.profit)}` : formatChips(hand.profit)}
                  </Text>
                ))
              : null}
            <View style={styles.statModern}>
              <Text style={[styles.chipsModern, { color: chipsTint }]}>{chipsLine}</Text>
              {xpAwarded > 0 ? <Text style={styles.xpModern}>+{xpAwarded} XP</Text> : null}
            </View>
          </ArcadePanel>
        </View>
      </Animated.View>
    );
  }

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
  /* Modern: the level-brief panel with the result on its plaque. */
  wrapperModern: {
    paddingHorizontal: spacing.lg + spacing.xs,
  },
  stackModern: {
    width: MODERN_STACK_WIDTH,
    maxWidth: '100%',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  bannerModern: {
    pointerEvents: 'none',
    minWidth: 260,
    paddingTop: spacing.xs + spacing.xxs,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingBottom: spacing.sm + spacing.xxs,
    gap: spacing.xs + spacing.xxs,
    ...shadows.overlay,
  },
  handLineModern: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    lineHeight: fontSizes.caption + 7,
    color: colors.arcadeMuted,
    textAlign: 'center',
  },
  statModern: {
    alignItems: 'center',
    gap: spacing.xxs,
    paddingTop: spacing.xxs,
  },
  chipsModern: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 30,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  xpModern: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 22,
    color: colors.arcadeGold,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
});
