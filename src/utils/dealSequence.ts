import { RoundEvent } from '../engine/blackjack/round';

/** Cards in the opening deal: player → dealer hole → player → dealer up. */
export const INITIAL_DEAL_CARD_COUNT = 4;

/**
 * How many cards are on the table after each initial-deal step (1–4).
 * Step 0 means the deal has not started animating yet.
 */
export function initialDealVisibleCounts(step: number): { player: number; dealer: number } {
  if (step < 1) {
    return { player: 0, dealer: 0 };
  }
  if (step === 1) {
    return { player: 1, dealer: 0 };
  }
  if (step === 2) {
    return { player: 1, dealer: 1 };
  }
  if (step === 3) {
    return { player: 2, dealer: 1 };
  }
  return { player: 2, dealer: 2 };
}

/**
 * Hi-Lo count event to apply when a deal step completes. Steps 1, 3, and 4
 * reveal face-up cards; step 2 is the face-down hole (no count).
 */
export function countEventForInitialDealStep(
  events: readonly RoundEvent[],
  step: number,
): RoundEvent | null {
  const dealEvents = events.filter(
    (e): e is Extract<RoundEvent, { type: 'cardBecameVisible' }> =>
      e.type === 'cardBecameVisible' && e.source === 'deal',
  );
  const indexByStep: Record<number, number> = { 1: 0, 3: 1, 4: 2 };
  const index = indexByStep[step];
  return index === undefined ? null : (dealEvents[index] ?? null);
}

/**
 * Horizontal overlap between cards in a fan. Two- and three-card hands stay
 * nearly side-by-side; four or more tuck in like a real spread.
 */
export function cardFanOverlap(cardWidth: number, cardCount: number): number {
  if (cardCount <= 1) {
    return 0;
  }
  if (cardCount <= 3) {
    return Math.round(cardWidth * 0.12);
  }
  return Math.round(cardWidth * 0.38);
}
