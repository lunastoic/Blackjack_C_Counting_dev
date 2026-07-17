import {
  blackjackValue,
  cardLabel,
  hiLoValue,
  makeCard,
  Rank,
  RANKS,
  SUITS,
} from '../../engine/cards/card';
import { CARDS_PER_DECK, createDeck } from '../../engine/cards/deck';

describe('deck construction', () => {
  const deck = createDeck();

  it('contains exactly 52 cards', () => {
    expect(deck).toHaveLength(CARDS_PER_DECK);
    expect(deck).toHaveLength(52);
  });

  it('contains 52 unique card ids', () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('covers all 4 suits with 13 cards each', () => {
    expect(SUITS).toHaveLength(4);
    for (const suit of SUITS) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
    }
  });

  it('covers all 13 ranks with 4 cards each', () => {
    expect(RANKS).toHaveLength(13);
    for (const rank of RANKS) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
    }
  });

  it('creates cards face down by default', () => {
    expect(deck.every((c) => c.visibility === 'faceDown')).toBe(true);
  });

  it('gives distinct decks distinct ids', () => {
    const other = createDeck(1);
    const ids = new Set([...deck, ...other].map((c) => c.id));
    expect(ids.size).toBe(104);
  });
});

describe('blackjack values', () => {
  const expected: Record<Rank, number> = {
    A: 11,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 10,
    Q: 10,
    K: 10,
  };

  it.each(RANKS.map((rank) => [rank, expected[rank]]))('%s is worth %d', (rank, value) => {
    expect(blackjackValue(rank as Rank)).toBe(value);
  });
});

describe('Hi-Lo values for every rank', () => {
  const expected: Record<Rank, number> = {
    '2': 1,
    '3': 1,
    '4': 1,
    '5': 1,
    '6': 1,
    '7': 0,
    '8': 0,
    '9': 0,
    '10': -1,
    J: -1,
    Q: -1,
    K: -1,
    A: -1,
  };

  it.each(RANKS.map((rank) => [rank, expected[rank]]))('%s counts as %d', (rank, value) => {
    expect(hiLoValue(rank as Rank)).toBe(value);
  });
});

describe('card labels', () => {
  it('formats face cards and pips', () => {
    expect(cardLabel(makeCard('Q', 'hearts'))).toBe('Queen of Hearts');
    expect(cardLabel(makeCard('A', 'spades'))).toBe('Ace of Spades');
    expect(cardLabel(makeCard('10', 'clubs'))).toBe('10 of Clubs');
  });
});
