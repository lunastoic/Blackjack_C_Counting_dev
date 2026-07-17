import { Card, CardVisibility, makeCard, Rank, Suit } from '../cards/card';
import { createPlayerHand, DealerHand, PlayerHand } from '../hand/hand';
import { DeckCount, Shoe } from '../shoe/shoe';

export { seededRng } from '../shoe/rng';

/** Shorthand card builder for tests: card('A', 'spades'). */
export function card(
  rank: Rank,
  suit: Suit = 'spades',
  visibility: CardVisibility = 'faceUp',
  deckIndex = 0,
): Card {
  return makeCard(rank, suit, { deckIndex, visibility });
}

let fixtureCounter = 0;

/** Cards built from ranks only, cycling suits so ids stay unique. */
export function cardsOf(...ranks: Rank[]): Card[] {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  return ranks.map((rank, i) => card(rank, suits[i % suits.length], 'faceUp', fixtureCounter++));
}

export function playerHandOf(ranks: Rank[], overrides: Partial<PlayerHand> = {}): PlayerHand {
  return { ...createPlayerHand('test-hand', overrides.bet ?? 10, cardsOf(...ranks)), ...overrides };
}

export function dealerHandOf(holeRank: Rank, upRank: Rank, holeRevealed = false): DealerHand {
  const hole = card(holeRank, 'clubs', holeRevealed ? 'faceUp' : 'faceDown', 90);
  const up = card(upRank, 'diamonds', 'faceUp', 91);
  return { cards: [hole, up], holeRevealed };
}

/**
 * A rigged shoe that deals the given cards in order. Useful for scripting
 * exact rounds (deal order: player, hole, player, upcard, then hits).
 */
export function riggedShoe(cards: readonly Card[], deckCount: DeckCount = 1): Shoe {
  return { deckCount, cards, drawnCount: 0 };
}

export function riggedShoeOf(...ranks: Rank[]): Shoe {
  return riggedShoe(cardsOf(...ranks));
}
