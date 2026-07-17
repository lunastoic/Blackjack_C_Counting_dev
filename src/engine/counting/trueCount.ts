import { CARDS_PER_DECK } from '../cards/deck';

/** Rounds to the nearest 0.5 (e.g. 2.24 → 2, 2.25 → 2.5, −1.3 → −1.5 via standard rounding). */
export function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * True count = running count ÷ decks remaining, rounded to the nearest 0.5
 * (REBUILD_SPEC §5). decksRemaining = cardsRemaining / 52.
 *
 * Division-by-zero protection: with zero cards remaining the true count is
 * defined as 0 — an empty shoe forces a shuffle, which resets the running
 * count anyway. The result is never clamped.
 */
export function trueCount(runningCount: number, cardsRemaining: number): number {
  if (cardsRemaining <= 0) {
    return 0;
  }
  const decksRemaining = cardsRemaining / CARDS_PER_DECK;
  return roundToNearestHalf(runningCount / decksRemaining);
}
