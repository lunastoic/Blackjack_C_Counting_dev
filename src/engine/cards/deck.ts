import { Card, RANKS, SUITS, makeCard } from './card';

/**
 * Builds one standard 52-card deck. Cards are created face down; visibility is
 * assigned when a card is dealt. `deckIndex` keeps ids unique in multi-deck shoes.
 */
export function createDeck(deckIndex = 0): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(rank, suit, { deckIndex }));
    }
  }
  return deck;
}

export const CARDS_PER_DECK = 52;
