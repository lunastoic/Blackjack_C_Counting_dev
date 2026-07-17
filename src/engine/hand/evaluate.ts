import { blackjackValue, Card, Rank } from '../cards/card';
import { Hand, PlayerHand } from './hand';

export const BLACKJACK_TOTAL = 21;

export interface HandValue {
  /** Best total ≤ 21 when possible (aces demoted from 11 to 1 as needed). */
  readonly total: number;
  /** True when an ace is currently counted as 11. */
  readonly isSoft: boolean;
}

export function evaluateCards(cards: readonly Pick<Card, 'rank'>[]): HandValue {
  let total = 0;
  let acesAsEleven = 0;
  for (const card of cards) {
    total += blackjackValue(card.rank);
    if (card.rank === 'A') {
      acesAsEleven += 1;
    }
  }
  while (total > BLACKJACK_TOTAL && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven -= 1;
  }
  return { total, isSoft: acesAsEleven > 0 };
}

export function handValue(hand: Hand): HandValue {
  return evaluateCards(hand.cards);
}

export function isBust(hand: Hand): boolean {
  return handValue(hand).total > BLACKJACK_TOTAL;
}

export function isTwentyOne(hand: Hand): boolean {
  return handValue(hand).total === BLACKJACK_TOTAL;
}

/**
 * Natural blackjack: exactly two cards totalling 21 on a non-split hand.
 * A 21 made on a split hand is NOT a natural (pays 1:1 — REBUILD_SPEC §4).
 */
export function isNaturalBlackjack(hand: Hand & Partial<Pick<PlayerHand, 'isFromSplit'>>): boolean {
  if (hand.isFromSplit) {
    return false;
  }
  return hand.cards.length === 2 && isTwentyOne(hand);
}

/**
 * Split-eligibility value equality: matches on blackjack VALUE, not rank, so
 * 10+King, Queen+Jack, King+King all qualify (REBUILD_SPEC §4 + fix #5).
 */
export function isEqualSplitValue(rankA: Rank, rankB: Rank): boolean {
  return blackjackValue(rankA) === blackjackValue(rankB);
}

export function isValuePair(hand: Hand): boolean {
  return hand.cards.length === 2 && isEqualSplitValue(hand.cards[0].rank, hand.cards[1].rank);
}
