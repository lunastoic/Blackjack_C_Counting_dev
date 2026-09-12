import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { arcadeShadow } from '../arcade';
import { ChipStack } from './ChipStack';

/** Shared chip size for the felt bet spot across betting and in-round play. */
export const BET_SPOT_CHIP_SIZE = 44;

interface BetSpotProps {
  readonly chipSetKey: string;
  readonly maxBet: number;
  /** Chips in the spot while betting (before deal). */
  readonly wager: number;
  /** When set, renders this instead of the wager stack (in-round hand chips). */
  readonly children?: React.ReactNode;
  /** Show the empty "PLACE BET" state when wager is 0 and no children. */
  readonly showEmpty?: boolean;
}

/**
 * Fixed betting spot on the felt (an invisible circle). Hosts the wager pile while betting
 * and in-round hand chips after deal so the stack never remounts elsewhere.
 */
export function BetSpot({
  chipSetKey,
  maxBet,
  wager,
  children,
  showEmpty = true,
}: BetSpotProps) {
  const showWager = children == null && wager > 0;
  const showPlaceholder = children == null && wager <= 0 && showEmpty;
  const modern = useModernUi();

  return (
    <View
      style={[styles.circle, modern && styles.circleModern]}
      accessibilityLabel={`Bet spot, ${formatChips(wager)}`}
    >
      {children}
      {showWager ? (
        <ChipStack amount={wager} chipSetKey={chipSetKey} chipSize={BET_SPOT_CHIP_SIZE} />
      ) : null}
      {showPlaceholder ? (
        <>
          <Text style={[styles.betLabel, modern && styles.betLabelModern]}>PLACE BET</Text>
          <Text style={[styles.betValue, modern && styles.betValueModern]}>{formatChips(0)}</Text>
        </>
      ) : null}
      <Text style={[styles.maxBet, modern && styles.maxBetModern]}>Max {formatChips(maxBet)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    gap: 2,
    paddingBottom: spacing.xs,
  },
  betLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  betValue: {
    color: colors.goldBright,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  maxBet: {
    color: colors.textMuted,
    fontSize: 10,
  },
  /* Modern: the dashed gold ring; no token at 35% arcade gold, so borderGold (40%) stands in. */
  circleModern: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderGold,
  },
  betLabelModern: {
    fontFamily: fonts.display,
    fontWeight: undefined,
    fontSize: 18,
    lineHeight: 19,
    letterSpacing: 3,
    color: colors.arcadeCream,
    opacity: 0.8,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  betValueModern: {
    fontFamily: fonts.display,
    fontWeight: undefined,
    fontSize: 40,
    lineHeight: 40,
    color: colors.arcadeGold,
    includeFontPadding: false,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
  maxBetModern: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.arcadeMuted,
  },
});
