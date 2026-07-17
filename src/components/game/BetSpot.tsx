import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
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
 * Fixed circular betting spot on the felt. Hosts the wager pile while betting
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

  return (
    <View style={styles.circle} accessibilityLabel={`Bet spot, ${formatChips(wager)}`}>
      {children}
      {showWager ? (
        <ChipStack amount={wager} chipSetKey={chipSetKey} chipSize={BET_SPOT_CHIP_SIZE} />
      ) : null}
      {showPlaceholder ? (
        <>
          <Text style={styles.betLabel}>PLACE BET</Text>
          <Text style={styles.betValue}>{formatChips(0)}</Text>
        </>
      ) : null}
      <Text style={styles.maxBet}>Max {formatChips(maxBet)}</Text>
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
    borderWidth: 2,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlayLight,
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
});
