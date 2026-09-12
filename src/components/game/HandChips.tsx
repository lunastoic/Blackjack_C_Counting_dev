import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { HandResult } from '../../engine/blackjack/resolve';
import { RoundPhase } from '../../engine/state-machine/phases';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { colors, fonts, fontWeights } from '../../theme';
import { BET_SPOT_CHIP_SIZE } from './BetSpot';
import { ChipStack } from './ChipStack';

const SWEEP_MS = 450;
/** Fixed line under each pile for the DOUBLED / WIN tag, so chips share a base. */
const TAG_LINE_HEIGHT = 12;

interface HandChipsProps {
  /** The stake sitting in this hand's betting spot (already doubled if doubled). */
  readonly bet: number;
  readonly chipSetKey: string;
  readonly phase: RoundPhase;
  /** Resolution for this hand once known (null while the hand is live). */
  readonly result: HandResult | null;
  /** Net winnings for this hand (0 for push, negative for loss). */
  readonly profit: number;
  readonly doubled?: boolean;
  /** Hide amount labels when the parent bet spot already shows context. */
  readonly compact?: boolean;
  /** Drop-in animation when adding chips (betting only). */
  readonly animateStakeIn?: boolean;
}

/**
 * Real-table chip behavior for one hand's betting spot:
 * - the stake sits in the spot as a physical pile for the whole round;
 * - on a LOSS the dealer sweeps the pile away toward the top of the table;
 * - on a WIN the dealer cuts out a matching winnings pile to the left of the stake;
 * - when the table clears, kept piles slide down into the player's bankroll.
 */
export function HandChips({
  bet,
  chipSetKey,
  phase,
  result,
  profit,
  doubled,
  compact = false,
  animateStakeIn = false,
}: HandChipsProps) {
  const reducedMotion = useReducedMotion();
  const modern = useModernUi();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const lost = result === 'loss';
  const paidOut = (result === 'win' || result === 'blackjack') && profit > 0;
  const showWinnings = paidOut && (phase === 'payout' || phase === 'collecting');

  useEffect(() => {
    const settled = phase === 'payout' || phase === 'collecting' || phase === 'shuffling';
    if (settled && lost) {
      // Dealer takes the losing bet: sweep up and away.
      translateY.value = reducedMotion ? -60 : withTiming(-120, { duration: SWEEP_MS });
      opacity.value = reducedMotion ? 0 : withTiming(0, { duration: SWEEP_MS });
    } else if ((phase === 'collecting' || phase === 'shuffling') && result && !lost) {
      // Player rakes in the kept stake (and winnings): slide down to the rail.
      translateY.value = reducedMotion ? 60 : withDelay(80, withTiming(140, { duration: SWEEP_MS }));
      opacity.value = reducedMotion ? 0 : withDelay(80, withTiming(0, { duration: SWEEP_MS }));
    } else {
      translateY.value = 0;
      opacity.value = 1;
    }
  }, [phase, lost, result, reducedMotion, translateY, opacity]);

  useEffect(() => {
    if (showWinnings) {
      // The dealer sets the payout chips down next to the stake.
      playSound('chipTap');
    }
  }, [showWinnings]);

  const pileStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (bet <= 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.row, compact && styles.rowCompact, pileStyle]} pointerEvents="none">
      <View style={styles.pile}>
        {showWinnings ? (
          // Set down to the left of the stake, which stays put in its spot.
          <Animated.View
            style={[styles.pile, styles.winnings]}
            entering={reducedMotion ? undefined : FadeInUp.duration(320)}
          >
            <ChipStack
              amount={profit}
              chipSetKey={chipSetKey}
              chipSize={BET_SPOT_CHIP_SIZE}
              showLabel={!compact}
            />
            <View style={styles.tagSlot}>
              <Text
                style={[
                  styles.tag,
                  modern ? styles.tagModern : null,
                  modern ? styles.winTagModern : styles.winTag,
                ]}
              >
                WIN
              </Text>
            </View>
          </Animated.View>
        ) : null}
        <ChipStack
          amount={bet}
          chipSetKey={chipSetKey}
          chipSize={BET_SPOT_CHIP_SIZE}
          showLabel={!compact}
          animateIn={animateStakeIn}
        />
        {/* Both piles keep a tag line so their chips sit on the same base line. */}
        <View style={styles.tagSlot}>
          {doubled ? <Text style={[styles.tag, modern && styles.tagModern]}>DOUBLED</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    minHeight: 56,
  },
  rowCompact: {
    minHeight: 0,
  },
  pile: {
    alignItems: 'center',
    gap: 2,
  },
  winnings: {
    position: 'absolute',
    right: '100%',
    bottom: 0,
    marginRight: 12,
  },
  tagSlot: {
    height: TAG_LINE_HEIGHT,
    justifyContent: 'center',
  },
  tag: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: TAG_LINE_HEIGHT,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  winTag: {
    color: colors.success,
  },
  /* Modern */
  tagModern: {
    fontFamily: fonts.display,
    fontWeight: undefined,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.arcadeMuted,
    includeFontPadding: false,
  },
  winTagModern: {
    color: colors.arcadeMint,
  },
});
