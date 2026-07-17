import { RoundState } from '../engine/blackjack/round';
import { RoundPhase } from '../engine/state-machine/phases';
import { cardsDealt, cardsRemaining, Shoe } from '../engine/shoe/shoe';
import { INITIAL_DEAL_CARD_COUNT } from './dealSequence';

export function cardsOnTable(round: RoundState | null): number {
  if (!round) {
    return 0;
  }
  return (
    round.dealerHand.cards.length +
    round.playerHands.reduce((sum, hand) => sum + hand.cards.length, 0)
  );
}

/** Cards still in the shoe stack (synced with progressive opening deal). */
export function visibleShoeCount(
  shoe: Shoe | null,
  phase: RoundPhase,
  initialDealStep: number,
  pendingReveals: number,
): number {
  if (!shoe) {
    return 0;
  }
  let remaining = cardsRemaining(shoe) + pendingReveals;
  if (phase === 'dealing' && initialDealStep < INITIAL_DEAL_CARD_COUNT) {
    remaining += INITIAL_DEAL_CARD_COUNT - initialDealStep;
  }
  return remaining;
}

/** Dealt cards not on the table — grows during collection as hands clear.
 * `pendingReveals` are dealer draws already taken from the shoe but not yet
 * shown on the felt — they must not flash in the discard pile mid-reveal.
 */
export function visibleDiscardCount(
  shoe: Shoe | null,
  round: RoundState | null,
  phase: RoundPhase,
  pendingReveals = 0,
): number {
  if (!shoe) {
    return 0;
  }
  const onTable = cardsOnTable(round);
  const settled = Math.max(0, cardsDealt(shoe) - onTable - pendingReveals);
  if ((phase === 'collecting' || phase === 'shuffling') && round) {
    return settled + onTable;
  }
  return settled;
}

/** Subtle scale for the single shoe asset as cards are dealt. */
export function shoeFillRatio(count: number, totalCards: number): number {
  if (count <= 0) {
    return 0;
  }
  if (totalCards <= 0) {
    return 1;
  }
  return Math.max(0.38, Math.min(1, count / totalCards));
}

/** Map a card count to a visible stack depth (capped for performance). */
export function pileLayerCount(count: number, totalCards: number, maxLayers = 18): number {
  if (count <= 0) {
    return 0;
  }
  if (totalCards <= 0) {
    return Math.min(maxLayers, Math.max(1, count));
  }
  const ratio = count / totalCards;
  return Math.max(1, Math.min(maxLayers, Math.round(ratio * maxLayers)));
}
