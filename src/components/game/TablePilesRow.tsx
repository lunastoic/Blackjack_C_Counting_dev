import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoundState } from '../../engine/blackjack/round';
import { RoundPhase } from '../../engine/state-machine/phases';
import { isShufflePending, Shoe, shuffleThreshold } from '../../engine/shoe/shoe';
import { colors, fontWeights, layout, spacing } from '../../theme';
import { visibleDiscardCount, visibleShoeCount } from '../../utils/cardPiles';
import { CARD_ASPECT } from './PlayingCard';
import { CardStack } from './CardStack';

/**
 * Narrow side slots keep RUNNING / TRUE / CARDS LEFT fully visible.
 * Piles hang slightly past the slot toward the screen edges.
 */
const SIDE_WIDTH = 56;
const SHOE_CARD_WIDTH = 44;
const DISCARD_CARD_WIDTH = SHOE_CARD_WIDTH;
const STACK_SLOT_HEIGHT = Math.round(SHOE_CARD_WIDTH / CARD_ASPECT) + 10;
/** How far each pile sits past its slot toward the outer edge. */
const PILE_OUTWARD = 10;
/**
 * Clearance for the thin vertical meter bar only (value tag sits mid-screen,
 * not in this top band).
 */
const RAIL_BAR_CLEARANCE = layout.screenPaddingH + 10;

interface TablePilesRowProps {
  readonly center: React.ReactNode;
  readonly round: RoundState | null;
  readonly shoe: Shoe | null;
  readonly phase: RoundPhase;
  readonly initialDealStep: number;
  readonly pendingReveals: number;
  /** Leave room for the thin count meter bar on the left (training). */
  readonly insetForCountRail?: boolean;
  /** Show cut-card marker on the shoe (Regular Mode / Coach shoe progress). */
  readonly showCutCardMarker?: boolean;
}

function PileColumn({
  label,
  count,
  showCount = true,
  children,
}: {
  label: string;
  count: number;
  showCount?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.pileColumn}>
      <Text style={styles.pileLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.stackSlot}>{children}</View>
      <Text style={styles.pileCount}>{showCount || count > 0 ? count : ' '}</Text>
    </View>
  );
}

/**
 * Full-width flex row: discard | centered stats | deck.
 * Side piles sit above the stats capsule so they never get covered.
 */
export function TablePilesRow({
  center,
  round,
  shoe,
  phase,
  initialDealStep,
  pendingReveals,
  insetForCountRail = false,
  showCutCardMarker = false,
}: TablePilesRowProps) {
  const totalCards = shoe?.cards.length ?? 0;
  const shoeCount = visibleShoeCount(shoe, phase, initialDealStep, pendingReveals);
  const discardCount = visibleDiscardCount(shoe, round, phase, pendingReveals);
  const ceremonyActive = phase === 'shuffling';
  const nearCut =
    showCutCardMarker &&
    shoe != null &&
    (isShufflePending(shoe) || shoeCount <= shuffleThreshold(shoe.deckCount) * 2);

  return (
    <View
      style={[
        styles.band,
        {
          paddingLeft: insetForCountRail ? RAIL_BAR_CLEARANCE : layout.screenPaddingH,
        },
      ]}
    >
      <View
        style={[
          styles.side,
          styles.sideLeft,
          ceremonyActive && styles.pilesHidden,
        ]}
      >
        <PileColumn label="DISCARD" count={discardCount} showCount={false}>
          <CardStack
            variant="discard"
            count={ceremonyActive ? 0 : discardCount}
            totalCards={totalCards}
            cardWidth={DISCARD_CARD_WIDTH}
          />
        </PileColumn>
      </View>

      <View style={styles.center}>{center}</View>

      <View
        style={[
          styles.side,
          styles.sideRight,
          ceremonyActive && styles.pilesHidden,
        ]}
      >
        <PileColumn label="DECK" count={ceremonyActive ? 0 : shoeCount}>
          <CardStack
            variant="shoe"
            count={ceremonyActive ? 0 : shoeCount}
            totalCards={totalCards}
            cardWidth={SHOE_CARD_WIDTH}
            showCutCard={!ceremonyActive && nearCut}
          />
        </PileColumn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingRight: layout.screenPaddingH,
    paddingBottom: spacing.xs,
    minHeight: STACK_SLOT_HEIGHT + 30,
  },
  side: {
    width: SIDE_WIDTH,
    flexShrink: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  sideLeft: {
    marginLeft: -PILE_OUTWARD,
  },
  sideRight: {
    marginRight: -PILE_OUTWARD,
  },
  pilesHidden: {
    opacity: 0,
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    overflow: 'visible',
    zIndex: 0,
  },
  pileColumn: {
    width: SIDE_WIDTH,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  pileLabel: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.8,
    textAlign: 'center',
    width: '100%',
  },
  stackSlot: {
    width: SIDE_WIDTH,
    height: STACK_SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  pileCount: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
    height: 16,
    textAlign: 'center',
  },
});
