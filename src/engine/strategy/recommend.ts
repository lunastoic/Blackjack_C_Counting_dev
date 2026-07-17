import { blackjackValue, Card, Rank } from '../cards/card';
import { evaluateCards, isEqualSplitValue } from '../hand/evaluate';
import { PlayerHand } from '../hand/hand';
import { ActionAvailability, StrategyRecommendation } from './types';

/**
 * Basic strategy per REBUILD_SPEC §6, with the rebuild fixes: pairs match on
 * VALUE (10+K is a ten pair) and split hands get recommendations too.
 *
 * Tables and fallbacks live here only — tests and future UI must call this
 * module rather than re-encoding the rules.
 */

/** Dealer upcard strength: 2–10, with Ace as 11. */
type UpValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export function dealerUpValue(rank: Rank): UpValue {
  return blackjackValue(rank) as UpValue;
}

interface HandInput {
  readonly cards: readonly Pick<Card, 'rank'>[];
  readonly isFromSplit: boolean;
}

function between(value: number, low: number, high: number): boolean {
  return value >= low && value <= high;
}

function hardDecision(total: number, up: UpValue): StrategyRecommendation {
  if (total <= 7) {
    return { preferredAction: 'hit', reasonCode: `HARD_${total}_HIT` };
  }
  if (total === 8) {
    return between(up, 5, 6)
      ? { preferredAction: 'double', fallbackAction: 'hit', reasonCode: 'HARD_8_DOUBLE' }
      : { preferredAction: 'hit', reasonCode: 'HARD_8_HIT' };
  }
  if (total === 9) {
    return between(up, 2, 6)
      ? { preferredAction: 'double', fallbackAction: 'hit', reasonCode: 'HARD_9_DOUBLE' }
      : { preferredAction: 'hit', reasonCode: 'HARD_9_HIT' };
  }
  if (total === 10) {
    return between(up, 2, 9)
      ? { preferredAction: 'double', fallbackAction: 'hit', reasonCode: 'HARD_10_DOUBLE' }
      : { preferredAction: 'hit', reasonCode: 'HARD_10_HIT' };
  }
  if (total === 11) {
    return between(up, 2, 10)
      ? { preferredAction: 'double', fallbackAction: 'hit', reasonCode: 'HARD_11_DOUBLE' }
      : { preferredAction: 'hit', reasonCode: 'HARD_11_HIT' };
  }
  if (total === 12) {
    return between(up, 4, 6)
      ? { preferredAction: 'stand', reasonCode: 'HARD_12_STAND' }
      : { preferredAction: 'hit', reasonCode: 'HARD_12_HIT' };
  }
  if (between(total, 13, 16)) {
    return between(up, 2, 6)
      ? { preferredAction: 'stand', reasonCode: `HARD_${total}_STAND` }
      : { preferredAction: 'hit', reasonCode: `HARD_${total}_HIT` };
  }
  return { preferredAction: 'stand', reasonCode: `HARD_${total}_STAND` };
}

/** `total` is the soft total (ace as 11): A2 = 13 … A9 = 20. */
function softDecision(total: number, up: UpValue): StrategyRecommendation {
  if (total <= 12) {
    // Soft 12 (A-A when split is unavailable): just hit.
    return { preferredAction: 'hit', reasonCode: 'SOFT_12_HIT' };
  }
  if (between(total, 13, 16)) {
    // A2–A3 and A4–A5: double vs 4–6, otherwise hit.
    return between(up, 4, 6)
      ? { preferredAction: 'double', fallbackAction: 'hit', reasonCode: `SOFT_${total}_DOUBLE` }
      : { preferredAction: 'hit', reasonCode: `SOFT_${total}_HIT` };
  }
  if (total === 17) {
    // A6: double vs 3–6, otherwise hit.
    return between(up, 3, 6)
      ? { preferredAction: 'double', fallbackAction: 'hit', reasonCode: 'SOFT_17_DOUBLE' }
      : { preferredAction: 'hit', reasonCode: 'SOFT_17_HIT' };
  }
  if (total === 18) {
    // A7: double vs 3–6 (else stand); stand vs 2/7/8; hit vs 9/10/A.
    if (between(up, 3, 6)) {
      return { preferredAction: 'double', fallbackAction: 'stand', reasonCode: 'SOFT_18_DOUBLE' };
    }
    if (up === 2 || up === 7 || up === 8) {
      return { preferredAction: 'stand', reasonCode: 'SOFT_18_STAND' };
    }
    return { preferredAction: 'hit', reasonCode: 'SOFT_18_HIT' };
  }
  if (total === 19) {
    // A8: double vs 6, otherwise stand.
    return up === 6
      ? { preferredAction: 'double', fallbackAction: 'stand', reasonCode: 'SOFT_19_DOUBLE' }
      : { preferredAction: 'stand', reasonCode: 'SOFT_19_STAND' };
  }
  // A9+: stand.
  return { preferredAction: 'stand', reasonCode: `SOFT_${total}_STAND` };
}

/**
 * Pair table. Returns null when the hand should be played as a normal
 * hard/soft total (10-value pairs stand there as hard 20; 5-5 is hard 10).
 */
function pairSplitPrescribed(pairValue: number, up: UpValue): boolean {
  switch (pairValue) {
    case 11: // A-A
    case 8:
      return true;
    case 9:
      return between(up, 2, 6) || up === 8 || up === 9;
    case 7:
    case 6:
    case 3:
    case 2:
      return between(up, 2, 7);
    case 4:
      return between(up, 5, 6);
    default: // 10-value and 5-5 never split.
      return false;
  }
}

function nonPairDecision(
  hand: HandInput,
  up: UpValue,
  doubleAllowed: boolean,
): StrategyRecommendation {
  const { total, isSoft } = evaluateCards(hand.cards);
  const decision = isSoft ? softDecision(total, up) : hardDecision(total, up);
  if (decision.preferredAction === 'double' && !doubleAllowed) {
    const fallback = decision.fallbackAction ?? 'hit';
    return { preferredAction: fallback, reasonCode: `${decision.reasonCode}_FALLBACK` };
  }
  return decision;
}

/**
 * Full recommendation for the current hand against the dealer upcard.
 * `availability` reflects what is currently legal (chip affordability, one-split
 * max, two-card requirement); when the table prefers an unavailable action the
 * correct fallback is promoted to `preferredAction`.
 */
export function recommendAction(
  hand: HandInput,
  dealerUpRank: Rank,
  availability: ActionAvailability,
): StrategyRecommendation {
  const up = dealerUpValue(dealerUpRank);
  const isPair =
    hand.cards.length === 2 && isEqualSplitValue(hand.cards[0].rank, hand.cards[1].rank);

  if (isPair) {
    const pairValue = blackjackValue(hand.cards[0].rank);

    if (pairValue === 10) {
      return { preferredAction: 'stand', reasonCode: 'PAIR_TENS_STAND' };
    }

    // 5-5 plays as hard 10 — falls through to the hard table below.
    if (pairValue !== 5 && pairSplitPrescribed(pairValue, up)) {
      const fallback = nonPairDecision(hand, up, availability.canDouble);
      if (availability.canSplit) {
        return {
          preferredAction: 'split',
          fallbackAction: fallback.preferredAction,
          reasonCode: `PAIR_${pairValue === 11 ? 'ACES' : pairValue}_SPLIT`,
        };
      }
      return fallback;
    }

    if (pairValue === 9 && !pairSplitPrescribed(9, up)) {
      return { preferredAction: 'stand', reasonCode: 'PAIR_NINES_STAND' };
    }
  }

  return nonPairDecision(hand, up, availability.canDouble);
}

/** Convenience wrapper for a live PlayerHand. */
export function recommendForHand(
  hand: PlayerHand,
  dealerUpRank: Rank,
  availability: ActionAvailability,
): StrategyRecommendation {
  return recommendAction(
    { cards: hand.cards, isFromSplit: hand.isFromSplit },
    dealerUpRank,
    availability,
  );
}
