import { Card, hiLoValue, Rank } from '../cards/card';

export { hiLoValue };

/**
 * Hi-Lo running count. Updated ONLY through explicit visibility events (a card
 * became visible on the table) — never by animation timing. The dealer hole
 * card contributes only when the round controller emits its holeReveal event.
 *
 * The stored count is NEVER clamped; the −10…+10 clamp belongs to the visual
 * meter in a later milestone.
 */
export interface CountState {
  readonly runningCount: number;
}

export function createCount(): CountState {
  return { runningCount: 0 };
}

/** Applies one card that just became visible. */
export function applyVisibleCard(state: CountState, rank: Rank): CountState {
  return { runningCount: state.runningCount + hiLoValue(rank) };
}

export function applyVisibleCards(state: CountState, cards: readonly Pick<Card, 'rank'>[]): CountState {
  return cards.reduce((current, card) => applyVisibleCard(current, card.rank), state);
}

/** The shoe was shuffled: the count resets to 0 (REBUILD_SPEC §5). */
export function resetCount(): CountState {
  return createCount();
}
