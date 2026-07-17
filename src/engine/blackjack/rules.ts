import { DealerHand, PlayerHand } from '../hand/hand';
import { handValue, isValuePair } from '../hand/evaluate';
import { DEALER_STAND_TOTAL } from './constants';

export type GameMode = 'regular' | 'quiz';

export type PlayerAction = 'hit' | 'stand' | 'double' | 'split';

/**
 * S17 dealer policy: hit strictly below 17; stand on ALL 17s including soft 17.
 */
export function dealerShouldHit(hand: DealerHand): boolean {
  return handValue(hand).total < DEALER_STAND_TOTAL;
}

/**
 * Double Down: exactly two cards. Applies per hand, including split hands
 * (per-hand double after split is allowed — REBUILD_SPEC §4).
 * Affordability is checked separately via betting helpers.
 */
export function canDouble(hand: PlayerHand): boolean {
  return hand.status === 'active' && hand.cards.length === 2 && !hand.isDoubled;
}

/**
 * Split: two cards of equal blackjack VALUE (10+K qualifies), one split max.
 * Affordability is checked separately via betting helpers.
 */
export function canSplit(hand: PlayerHand, splitAlreadyUsed: boolean): boolean {
  return (
    hand.status === 'active' &&
    !splitAlreadyUsed &&
    !hand.isFromSplit &&
    isValuePair(hand)
  );
}
