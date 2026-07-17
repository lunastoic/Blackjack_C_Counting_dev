import { Card, CardVisibility, Rank, RANKS, withVisibility } from '../cards/card';
import { CARDS_PER_DECK, createDeck } from '../cards/deck';
import { defaultRng, fisherYatesShuffle, Rng } from './rng';

export const DECK_COUNTS = [1, 2, 4, 6, 8] as const;
export type DeckCount = (typeof DECK_COUNTS)[number];

/**
 * Immutable multi-deck shoe. `cards` is the shuffled order; `drawnCount` marks
 * how many have been dealt. All operations return a new Shoe.
 */
export interface Shoe {
  readonly deckCount: DeckCount;
  readonly cards: readonly Card[];
  readonly drawnCount: number;
}

export class EmptyShoeError extends Error {
  constructor() {
    super('Cannot draw from an empty shoe');
    this.name = 'EmptyShoeError';
  }
}

export function createShoe(deckCount: DeckCount, rng: Rng = defaultRng): Shoe {
  const cards: Card[] = [];
  for (let deckIndex = 0; deckIndex < deckCount; deckIndex++) {
    cards.push(...createDeck(deckIndex));
  }
  return {
    deckCount,
    cards: fisherYatesShuffle(cards, rng),
    drawnCount: 0,
  };
}

/** Rebuilds and reshuffles the full shoe (all cards returned). */
export function resetShoe(shoe: Shoe, rng: Rng = defaultRng): Shoe {
  return createShoe(shoe.deckCount, rng);
}

export function cardsRemaining(shoe: Shoe): number {
  return shoe.cards.length - shoe.drawnCount;
}

export function cardsDealt(shoe: Shoe): number {
  return shoe.drawnCount;
}

export function isEmpty(shoe: Shoe): boolean {
  return cardsRemaining(shoe) === 0;
}

export interface DrawResult {
  readonly shoe: Shoe;
  readonly card: Card;
}

/** Draws one card with the given table visibility. Throws EmptyShoeError when exhausted. */
export function draw(shoe: Shoe, visibility: CardVisibility): DrawResult {
  if (isEmpty(shoe)) {
    throw new EmptyShoeError();
  }
  const card = withVisibility(shoe.cards[shoe.drawnCount], visibility);
  return {
    shoe: { ...shoe, drawnCount: shoe.drawnCount + 1 },
    card,
  };
}

export interface DrawManyResult {
  readonly shoe: Shoe;
  readonly cards: readonly Card[];
}

export function drawMany(shoe: Shoe, count: number, visibility: CardVisibility): DrawManyResult {
  let current = shoe;
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const result = draw(current, visibility);
    current = result.shoe;
    cards.push(result.card);
  }
  return { shoe: current, cards };
}

/** Count of each rank still undealt — powers the dealt-vs-remaining training charts. */
export function remainingRankDistribution(shoe: Shoe): Record<Rank, number> {
  const distribution = Object.fromEntries(RANKS.map((rank) => [rank, 0])) as Record<Rank, number>;
  for (let i = shoe.drawnCount; i < shoe.cards.length; i++) {
    distribution[shoe.cards[i].rank] += 1;
  }
  return distribution;
}

/**
 * Cards left undealt when the cut card is reached (~88% penetration / 12% unused).
 * 1-deck → 6, 2 → 12, 4 → 25, 6 → 37, 8 → 50.
 */
export function shuffleThreshold(deckCount: DeckCount): number {
  return Math.round(totalCards(deckCount) * 0.12);
}

/** How many cards have been dealt when the cut card arrives. */
export function cutCardDealtCount(deckCount: DeckCount): number {
  return totalCards(deckCount) - shuffleThreshold(deckCount);
}

/**
 * True when penetration has been reached and the shoe should be shuffled after
 * the current round resolves ("Shuffling deck after this round").
 */
export function isShufflePending(shoe: Shoe): boolean {
  return cardsRemaining(shoe) <= shuffleThreshold(shoe.deckCount);
}

export function totalCards(deckCount: DeckCount): number {
  return deckCount * CARDS_PER_DECK;
}
