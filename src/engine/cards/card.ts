/**
 * Core card domain: suits, ranks, card values, and labels.
 * Pure TypeScript — no React Native / Expo imports allowed in src/engine.
 */

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

export type CardVisibility = 'faceUp' | 'faceDown';

export interface Card {
  /** Stable unique id across a whole shoe, e.g. "d2-Q-hearts" (deck 2, queen of hearts). */
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly visibility: CardVisibility;
}

/** Blackjack value. Ace counts as 11 here; hand evaluation demotes aces to 1 as needed. */
export function blackjackValue(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 11;
    case 'K':
    case 'Q':
    case 'J':
    case '10':
      return 10;
    default:
      return Number(rank);
  }
}

/** Hi-Lo count value: 2–6 = +1, 7–9 = 0, 10/J/Q/K/A = −1. */
export function hiLoValue(rank: Rank): -1 | 0 | 1 {
  switch (rank) {
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      return 1;
    case '7':
    case '8':
    case '9':
      return 0;
    default:
      return -1;
  }
}

const RANK_NAMES: Record<Rank, string> = {
  A: 'Ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
};

const SUIT_NAMES: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

/** Human-readable label, e.g. "Queen of Hearts". */
export function cardLabel(card: Pick<Card, 'rank' | 'suit'>): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

export function cardId(deckIndex: number, rank: Rank, suit: Suit): string {
  return `d${deckIndex}-${rank}-${suit}`;
}

export function makeCard(
  rank: Rank,
  suit: Suit,
  options: { deckIndex?: number; visibility?: CardVisibility } = {},
): Card {
  return {
    id: cardId(options.deckIndex ?? 0, rank, suit),
    rank,
    suit,
    visibility: options.visibility ?? 'faceDown',
  };
}

export function withVisibility(card: Card, visibility: CardVisibility): Card {
  return card.visibility === visibility ? card : { ...card, visibility };
}

export function isFaceUp(card: Card): boolean {
  return card.visibility === 'faceUp';
}
