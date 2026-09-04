import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HandResult } from '../../engine/blackjack/resolve';
import { SeatFrame, TableFrame } from '../../engine/dojo';
import { PlayerHand } from '../../engine/hand/hand';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { ChipStack } from '../game/ChipStack';
import { DealerArea } from '../game/DealerArea';
import { HandView } from '../game/HandView';
import { DeckGauge } from './DeckGauge';

interface TableStageProps {
  readonly table: TableFrame;
  /** Seats the level lays out, so the felt keeps its shape between hands. */
  readonly seatCount: number;
  readonly cardWidth: number;
  readonly speed: number;
  /** Chips on every spot, results called at the end of the hand. */
  readonly distractions: boolean;
  readonly chipSetKey: string;
  /** Stand-in wager on every simulated seat (the casino's smallest chip) — decoration only, never the player's chips. */
  readonly stake: number;
  /** Discard tray + shoe beside the dealer. */
  readonly piles: { readonly drawn: number; readonly remaining: number; readonly totalCards: number; readonly showScale: boolean } | null;
}

function resultLabel(result: HandResult): string {
  switch (result) {
    case 'blackjack':
      return 'BLACKJACK';
    case 'win':
      return 'WIN';
    case 'push':
      return 'PUSH';
    case 'loss':
      return 'LOSS';
  }
}

function resultColor(result: HandResult): string {
  switch (result) {
    case 'blackjack':
    case 'win':
      return colors.success;
    case 'push':
      return colors.warning;
    case 'loss':
      return colors.error;
  }
}

/** Chips on the spot: the stake, doubled when the hand doubled, paid when it won. */
function seatChips(hand: PlayerHand, result: HandResult | null, unit: number): number {
  const stake = hand.isDoubled ? unit * 2 : unit;
  switch (result) {
    case 'blackjack':
      return stake + Math.round(stake * 1.5);
    case 'win':
      return stake * 2;
    case 'loss':
      return 0;
    default:
      return stake;
  }
}

/**
 * The live table's own dealer and hand components laid out from a script
 * frame: dealer up top, one to four seats across the bottom. Every seat is
 * played by the house — the trainee only watches and counts.
 */
export function TableStage({
  table,
  seatCount,
  cardWidth,
  speed,
  distractions,
  chipSetKey,
  stake,
  piles,
}: TableStageProps) {
  const dealer = table.dealer && table.dealer.cards.length > 0 ? { dealerHand: table.dealer } : null;
  const seats: (SeatFrame | null)[] = Array.from(
    { length: seatCount },
    (_, index) => table.seats[index] ?? null,
  );

  return (
    <View style={styles.stage}>
      <View style={styles.dealerRow}>
        {piles ? (
          <View style={styles.pileSlot}>
            <DeckGauge
              variant="discard"
              count={piles.drawn}
              totalCards={piles.totalCards}
              showScale={piles.showScale}
            />
          </View>
        ) : null}
        <View style={styles.dealerArea}>
          <DealerArea
            round={dealer}
            dealerCardWidth={cardWidth}
            skin="regular"
            underglow={false}
            speed={speed}
            areaLabel="DEALER"
            emptyLabel=" "
            spacedCards
          />
        </View>
        {piles ? (
          <View style={styles.pileSlot}>
            <DeckGauge
              variant="shoe"
              count={piles.remaining}
              totalCards={piles.totalCards}
              showScale={piles.showScale}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.seatRow}>
        {seats.map((seat, index) => {
          const hands = seat?.hands ?? [];
          const split = hands.length > 1;
          const handWidth = split ? Math.round(cardWidth * 0.82) : cardWidth;
          return (
            <View key={index} style={styles.seat}>
              <View style={styles.hands}>
                {hands.map((hand, handIndex) => {
                  const result = seat?.results[handIndex] ?? null;
                  return (
                    <View key={hand.id} style={styles.hand}>
                      {distractions && result ? (
                        <Text style={[styles.resultTag, { color: resultColor(result), borderColor: resultColor(result) }]}>
                          {resultLabel(result)}
                        </Text>
                      ) : null}
                      <HandView
                        hand={hand}
                        skin="regular"
                        cardWidth={handWidth}
                        underglow={false}
                        speed={speed}
                        staggerMs={0}
                        glowHalo={false}
                      />
                      {distractions ? (
                        <ChipStack
                          amount={seatChips(hand, result, stake)}
                          chipSetKey={chipSetKey}
                          chipSize={22}
                          showLabel={false}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.seatLabel}>
                {seatCount === 1 ? 'YOU' : `PLAYER ${index + 1}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
  },
  /** Capped so the piles sit beside the dealer, not out at the screen edges. */
  dealerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 300,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 150,
    flexShrink: 0,
  },
  dealerArea: {
    flex: 1,
    alignItems: 'center',
  },
  pileSlot: {
    width: 48,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  seatRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  seat: {
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 150,
    justifyContent: 'flex-end',
  },
  hands: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  hand: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  resultTag: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    backgroundColor: colors.overlayLight,
    overflow: 'hidden',
  },
  seatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
});
