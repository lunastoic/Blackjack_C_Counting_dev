import { decomposeChips } from '../../utils/chips';

/**
 * Casino chip decomposition: payouts and bets must break into physical chips
 * the way a dealer cuts them — largest denomination first.
 */
describe('decomposeChips', () => {
  const LUNA = [1, 5, 25, 50, 100];
  const EUROPA = [25, 50, 100, 500, 1000];

  it('breaks a bet into largest-first chips', () => {
    expect(decomposeChips(175, LUNA)).toEqual([100, 50, 25]);
    expect(decomposeChips(130, LUNA)).toEqual([100, 25, 5]);
    expect(decomposeChips(7, LUNA)).toEqual([5, 1, 1]);
  });

  it('handles a 3:2 blackjack payout (150 on a 100 bet)', () => {
    expect(decomposeChips(150, LUNA)).toEqual([100, 50]);
  });

  it('uses the map-specific denominations', () => {
    expect(decomposeChips(1575, EUROPA)).toEqual([1000, 500, 50, 25]);
  });

  it('caps the pile size for huge amounts while keeping the largest chips', () => {
    const chips = decomposeChips(100_000, LUNA);
    expect(chips.length).toBeLessThanOrEqual(10);
    expect(chips.every((v) => v === 100)).toBe(true);
  });

  it('represents a sub-denomination remainder with one smallest chip', () => {
    // 37 on Europa (min chip 25): one 25 + one 25 standing in for the 12.
    expect(decomposeChips(37, EUROPA)).toEqual([25, 25]);
  });

  it('returns nothing for zero, negative, or denomination-less input', () => {
    expect(decomposeChips(0, LUNA)).toEqual([]);
    expect(decomposeChips(-50, LUNA)).toEqual([]);
    expect(decomposeChips(100, [])).toEqual([]);
  });
});
