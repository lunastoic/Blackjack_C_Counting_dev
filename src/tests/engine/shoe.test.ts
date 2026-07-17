import { seededRng } from '../../engine/shoe/rng';
import {
  cardsDealt,
  cardsRemaining,
  cutCardDealtCount,
  createShoe,
  DECK_COUNTS,
  draw,
  drawMany,
  EmptyShoeError,
  isShufflePending,
  remainingRankDistribution,
  resetShoe,
  shuffleThreshold,
  totalCards,
} from '../../engine/shoe/shoe';
import { RANKS } from '../../engine/cards/card';

describe('multi-deck shoes', () => {
  it.each(DECK_COUNTS.map((d) => [d, d * 52]))(
    '%d-deck shoe holds %d cards',
    (deckCount, expected) => {
      const shoe = createShoe(deckCount, seededRng(1));
      expect(shoe.cards).toHaveLength(expected);
      expect(cardsRemaining(shoe)).toBe(expected);
      expect(totalCards(deckCount)).toBe(expected);
    },
  );

  it('holds unique card ids across decks', () => {
    const shoe = createShoe(8, seededRng(2));
    expect(new Set(shoe.cards.map((c) => c.id)).size).toBe(416);
  });
});

describe('shuffling', () => {
  it('is deterministic with the same seed', () => {
    const a = createShoe(6, seededRng(42));
    const b = createShoe(6, seededRng(42));
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id));
  });

  it('differs across seeds', () => {
    const a = createShoe(6, seededRng(42));
    const b = createShoe(6, seededRng(43));
    expect(a.cards.map((c) => c.id)).not.toEqual(b.cards.map((c) => c.id));
  });

  it('resetShoe returns a full reshuffled shoe', () => {
    let shoe = createShoe(1, seededRng(7));
    shoe = drawMany(shoe, 40, 'faceUp').shoe;
    const reset = resetShoe(shoe, seededRng(8));
    expect(cardsRemaining(reset)).toBe(52);
    expect(cardsDealt(reset)).toBe(0);
  });
});

describe('drawing', () => {
  it('tracks cards remaining and dealt', () => {
    let shoe = createShoe(1, seededRng(3));
    expect(cardsDealt(shoe)).toBe(0);

    const result = draw(shoe, 'faceUp');
    shoe = result.shoe;
    expect(result.card.visibility).toBe('faceUp');
    expect(cardsDealt(shoe)).toBe(1);
    expect(cardsRemaining(shoe)).toBe(51);

    shoe = drawMany(shoe, 5, 'faceDown').shoe;
    expect(cardsDealt(shoe)).toBe(6);
    expect(cardsRemaining(shoe)).toBe(46);
  });

  it('draws distinct cards in shuffled order', () => {
    const shoe = createShoe(1, seededRng(4));
    const { cards } = drawMany(shoe, 52, 'faceUp');
    expect(new Set(cards.map((c) => c.id)).size).toBe(52);
  });

  it('throws a typed error when empty', () => {
    const shoe = createShoe(1, seededRng(5));
    const drained = drawMany(shoe, 52, 'faceUp').shoe;
    expect(cardsRemaining(drained)).toBe(0);
    expect(() => draw(drained, 'faceUp')).toThrow(EmptyShoeError);
  });
});

describe('remaining rank distribution', () => {
  it('starts at deckCount × 4 per rank and decrements as cards leave', () => {
    let shoe = createShoe(2, seededRng(6));
    const initial = remainingRankDistribution(shoe);
    for (const rank of RANKS) {
      expect(initial[rank]).toBe(8);
    }

    const result = draw(shoe, 'faceUp');
    shoe = result.shoe;
    const after = remainingRankDistribution(shoe);
    expect(after[result.card.rank]).toBe(7);
    const total = RANKS.reduce((sum, rank) => sum + after[rank], 0);
    expect(total).toBe(103);
  });
});

describe('shuffle penetration thresholds (88% cut card)', () => {
  it('leaves ~12% of the shoe unused at the cut', () => {
    expect(shuffleThreshold(1)).toBe(6);
    expect(shuffleThreshold(2)).toBe(12);
    expect(shuffleThreshold(4)).toBe(25);
    expect(shuffleThreshold(6)).toBe(37);
    expect(shuffleThreshold(8)).toBe(50);
  });

  it('cuts after 46 / 92 / 183 / 275 / 366 cards by deck count', () => {
    expect(cutCardDealtCount(1)).toBe(46);
    expect(cutCardDealtCount(2)).toBe(92);
    expect(cutCardDealtCount(4)).toBe(183);
    expect(cutCardDealtCount(6)).toBe(275);
    expect(cutCardDealtCount(8)).toBe(366);
  });

  it('flags pending shuffle exactly at the 1-deck cut', () => {
    let shoe = createShoe(1, seededRng(9));
    shoe = drawMany(shoe, 52 - 7, 'faceUp').shoe; // 7 remaining
    expect(isShufflePending(shoe)).toBe(false);

    shoe = draw(shoe, 'faceUp').shoe; // 6 remaining
    expect(isShufflePending(shoe)).toBe(true);
  });

  it('flags pending shuffle for a 6-deck shoe at 37 remaining', () => {
    let shoe = createShoe(6, seededRng(10));
    shoe = drawMany(shoe, 312 - 38, 'faceUp').shoe; // 38 remaining
    expect(isShufflePending(shoe)).toBe(false);
    shoe = draw(shoe, 'faceUp').shoe; // 37 remaining
    expect(isShufflePending(shoe)).toBe(true);
  });
});
