import {
  evaluateCards,
  isBust,
  isEqualSplitValue,
  isNaturalBlackjack,
  isTwentyOne,
  isValuePair,
} from '../../engine/hand/evaluate';
import { cardsOf, playerHandOf } from '../../engine/testing/fixtures';

describe('hard hand totals', () => {
  it.each([
    [['2', '3'], 5],
    [['10', '7'], 17],
    [['K', 'Q'], 20],
    [['5', '9', '6'], 20],
    [['2', '2', '2', '2'], 8],
  ] as const)('%j totals %d', (ranks, total) => {
    const value = evaluateCards(cardsOf(...ranks));
    expect(value.total).toBe(total);
    expect(value.isSoft).toBe(false);
  });
});

describe('soft hand totals', () => {
  it('A + 6 is soft 17', () => {
    const value = evaluateCards(cardsOf('A', '6'));
    expect(value.total).toBe(17);
    expect(value.isSoft).toBe(true);
  });

  it('A + 6 + 10 becomes hard 17', () => {
    const value = evaluateCards(cardsOf('A', '6', '10'));
    expect(value.total).toBe(17);
    expect(value.isSoft).toBe(false);
  });

  it('soft hands harden when drawing over 21', () => {
    const value = evaluateCards(cardsOf('A', '4', '9'));
    expect(value.total).toBe(14);
    expect(value.isSoft).toBe(false);
  });
});

describe('multiple aces', () => {
  it('A + A is soft 12', () => {
    const value = evaluateCards(cardsOf('A', 'A'));
    expect(value.total).toBe(12);
    expect(value.isSoft).toBe(true);
  });

  it('A + A + 9 is soft 21', () => {
    const value = evaluateCards(cardsOf('A', 'A', '9'));
    expect(value.total).toBe(21);
    expect(value.isSoft).toBe(true);
  });

  it('four aces total 14', () => {
    const value = evaluateCards(cardsOf('A', 'A', 'A', 'A'));
    expect(value.total).toBe(14);
    expect(value.isSoft).toBe(true);
  });
});

describe('bust and 21 detection', () => {
  it('detects busts', () => {
    expect(isBust(playerHandOf(['10', '9', '5']))).toBe(true);
    expect(isBust(playerHandOf(['10', '9', '2']))).toBe(false);
  });

  it('detects 21', () => {
    expect(isTwentyOne(playerHandOf(['7', '7', '7']))).toBe(true);
    expect(isTwentyOne(playerHandOf(['10', '9']))).toBe(false);
  });
});

describe('natural blackjack', () => {
  it('two-card 21 on a fresh hand is natural', () => {
    expect(isNaturalBlackjack(playerHandOf(['A', 'K']))).toBe(true);
  });

  it('three-card 21 is not natural', () => {
    expect(isNaturalBlackjack(playerHandOf(['7', '7', '7']))).toBe(false);
  });

  it('two-card 21 on a SPLIT hand is not natural (pays 1:1)', () => {
    expect(isNaturalBlackjack(playerHandOf(['A', 'K'], { isFromSplit: true }))).toBe(false);
  });
});

describe('equal-value split detection', () => {
  it('10 + King are split-eligible', () => {
    expect(isEqualSplitValue('10', 'K')).toBe(true);
  });

  it('Queen + Jack are split-eligible', () => {
    expect(isEqualSplitValue('Q', 'J')).toBe(true);
  });

  it('King + King are split-eligible', () => {
    expect(isEqualSplitValue('K', 'K')).toBe(true);
  });

  it('Ace + King are NOT split-eligible', () => {
    expect(isEqualSplitValue('A', 'K')).toBe(false);
  });

  it('value pairs require exactly two cards', () => {
    expect(isValuePair(playerHandOf(['10', 'K']))).toBe(true);
    expect(isValuePair(playerHandOf(['10', 'K', '2']))).toBe(false);
    expect(isValuePair(playerHandOf(['10', '9']))).toBe(false);
  });
});
