import { Rank } from '../../engine/cards/card';
import { recommendAction } from '../../engine/strategy/recommend';
import { ActionAvailability } from '../../engine/strategy/types';
import { cardsOf } from '../../engine/testing/fixtures';

const ALL: ActionAvailability = { canDouble: true, canSplit: true };
const NO_DOUBLE: ActionAvailability = { canDouble: false, canSplit: true };
const NO_SPLIT: ActionAvailability = { canDouble: true, canSplit: false };
const NONE: ActionAvailability = { canDouble: false, canSplit: false };

function rec(ranks: Rank[], up: Rank, availability: ActionAvailability = ALL, isFromSplit = false) {
  return recommendAction({ cards: cardsOf(...ranks), isFromSplit }, up, availability);
}

describe('hard totals', () => {
  it('hard 5–7 hit', () => {
    expect(rec(['2', '3'], '2').preferredAction).toBe('hit');
    expect(rec(['3', '4'], 'A').preferredAction).toBe('hit');
  });

  it('hard 8: double vs 5–6, otherwise hit', () => {
    expect(rec(['3', '5'], '5').preferredAction).toBe('double');
    expect(rec(['3', '5'], '6').preferredAction).toBe('double');
    expect(rec(['3', '5'], '4').preferredAction).toBe('hit');
    expect(rec(['3', '5'], '7').preferredAction).toBe('hit');
  });

  it('hard 9: double vs 2–6, otherwise hit', () => {
    expect(rec(['4', '5'], '2').preferredAction).toBe('double');
    expect(rec(['4', '5'], '6').preferredAction).toBe('double');
    expect(rec(['4', '5'], '7').preferredAction).toBe('hit');
  });

  it('hard 10: double vs 2–9, otherwise hit', () => {
    expect(rec(['4', '6'], '9').preferredAction).toBe('double');
    expect(rec(['4', '6'], '10').preferredAction).toBe('hit');
    expect(rec(['4', '6'], 'A').preferredAction).toBe('hit');
  });

  it('hard 11: double vs 2–10, hit vs Ace', () => {
    expect(rec(['5', '6'], '2').preferredAction).toBe('double');
    expect(rec(['5', '6'], 'K').preferredAction).toBe('double');
    expect(rec(['5', '6'], 'A').preferredAction).toBe('hit');
  });

  it('hard 12: stand vs 4–6, otherwise hit', () => {
    expect(rec(['10', '2'], '4').preferredAction).toBe('stand');
    expect(rec(['10', '2'], '6').preferredAction).toBe('stand');
    expect(rec(['10', '2'], '2').preferredAction).toBe('hit');
    expect(rec(['10', '2'], '7').preferredAction).toBe('hit');
  });

  it('hard 13–16: stand vs 2–6, otherwise hit', () => {
    expect(rec(['10', '3'], '2').preferredAction).toBe('stand');
    expect(rec(['10', '6'], '6').preferredAction).toBe('stand');
    expect(rec(['10', '6'], '7').preferredAction).toBe('hit');
    expect(rec(['10', '4'], 'A').preferredAction).toBe('hit');
  });

  it('hard 17+: stand', () => {
    expect(rec(['10', '7'], 'A').preferredAction).toBe('stand');
    expect(rec(['10', '9'], '6').preferredAction).toBe('stand');
  });
});

describe('soft totals', () => {
  it('A2–A3: double vs 4–6, otherwise hit', () => {
    expect(rec(['A', '2'], '4').preferredAction).toBe('double');
    expect(rec(['A', '3'], '6').preferredAction).toBe('double');
    expect(rec(['A', '2'], '3').preferredAction).toBe('hit');
    expect(rec(['A', '3'], '7').preferredAction).toBe('hit');
  });

  it('A4–A5: double vs 4–6, otherwise hit', () => {
    expect(rec(['A', '4'], '5').preferredAction).toBe('double');
    expect(rec(['A', '5'], '4').preferredAction).toBe('double');
    expect(rec(['A', '5'], '3').preferredAction).toBe('hit');
  });

  it('A6: double vs 3–6, otherwise hit', () => {
    expect(rec(['A', '6'], '3').preferredAction).toBe('double');
    expect(rec(['A', '6'], '6').preferredAction).toBe('double');
    expect(rec(['A', '6'], '2').preferredAction).toBe('hit');
    expect(rec(['A', '6'], '7').preferredAction).toBe('hit');
  });

  it('A7: double vs 3–6, stand vs 2/7/8, hit vs 9/10/A', () => {
    expect(rec(['A', '7'], '3').preferredAction).toBe('double');
    expect(rec(['A', '7'], '6').preferredAction).toBe('double');
    expect(rec(['A', '7'], '2').preferredAction).toBe('stand');
    expect(rec(['A', '7'], '7').preferredAction).toBe('stand');
    expect(rec(['A', '7'], '8').preferredAction).toBe('stand');
    expect(rec(['A', '7'], '9').preferredAction).toBe('hit');
    expect(rec(['A', '7'], 'Q').preferredAction).toBe('hit');
    expect(rec(['A', '7'], 'A').preferredAction).toBe('hit');
  });

  it('A8: double vs 6, otherwise stand', () => {
    expect(rec(['A', '8'], '6').preferredAction).toBe('double');
    expect(rec(['A', '8'], '5').preferredAction).toBe('stand');
    expect(rec(['A', '8'], '10').preferredAction).toBe('stand');
  });

  it('A9+: stand', () => {
    expect(rec(['A', '9'], '6').preferredAction).toBe('stand');
  });

  it('multi-card soft hands use the soft total', () => {
    // A + 2 + 4 = soft 17 → double vs 3–6 unavailable (3 cards ⇒ caller passes canDouble false).
    expect(rec(['A', '2', '4'], '4', NO_DOUBLE).preferredAction).toBe('hit');
  });
});

describe('pairs (matched by value)', () => {
  it('always splits A-A and 8-8', () => {
    expect(rec(['A', 'A'], '2').preferredAction).toBe('split');
    expect(rec(['A', 'A'], 'A').preferredAction).toBe('split');
    expect(rec(['8', '8'], '10').preferredAction).toBe('split');
  });

  it('never splits 10-value pairs — including 10+K and Q+J', () => {
    expect(rec(['10', 'K'], '6')).toMatchObject({
      preferredAction: 'stand',
      reasonCode: 'PAIR_TENS_STAND',
    });
    expect(rec(['Q', 'J'], '5').preferredAction).toBe('stand');
    expect(rec(['K', 'K'], '6').preferredAction).toBe('stand');
  });

  it('treats 5-5 as hard 10', () => {
    expect(rec(['5', '5'], '9').preferredAction).toBe('double');
    expect(rec(['5', '5'], '10').preferredAction).toBe('hit');
    expect(rec(['5', '5'], '4').preferredAction).not.toBe('split');
  });

  it('9-9: split vs 2–6/8/9, stand vs 7/10/A', () => {
    expect(rec(['9', '9'], '2').preferredAction).toBe('split');
    expect(rec(['9', '9'], '6').preferredAction).toBe('split');
    expect(rec(['9', '9'], '8').preferredAction).toBe('split');
    expect(rec(['9', '9'], '9').preferredAction).toBe('split');
    expect(rec(['9', '9'], '7').preferredAction).toBe('stand');
    expect(rec(['9', '9'], 'K').preferredAction).toBe('stand');
    expect(rec(['9', '9'], 'A').preferredAction).toBe('stand');
  });

  it('7-7, 6-6, 3-3, 2-2: split vs 2–7', () => {
    for (const rank of ['7', '6', '3', '2'] as Rank[]) {
      expect(rec([rank, rank], '2').preferredAction).toBe('split');
      expect(rec([rank, rank], '7').preferredAction).toBe('split');
      expect(rec([rank, rank], '8').preferredAction).not.toBe('split');
    }
  });

  it('4-4: split vs 5–6 only', () => {
    expect(rec(['4', '4'], '5').preferredAction).toBe('split');
    expect(rec(['4', '4'], '6').preferredAction).toBe('split');
    expect(rec(['4', '4'], '4').preferredAction).not.toBe('split');
    expect(rec(['4', '4'], '7').preferredAction).not.toBe('split');
  });
});

describe('fallbacks and split hands', () => {
  it('double preferred but unavailable falls back to hit', () => {
    const result = rec(['5', '6'], '6', NONE);
    expect(result.preferredAction).toBe('hit');
    expect(result.reasonCode).toBe('HARD_11_DOUBLE_FALLBACK');
  });

  it('A8 double vs 6 falls back to stand', () => {
    const result = rec(['A', '8'], '6', NONE);
    expect(result.preferredAction).toBe('stand');
    expect(result.reasonCode).toBe('SOFT_19_DOUBLE_FALLBACK');
  });

  it('split preferred carries the non-pair fallback action', () => {
    const result = rec(['8', '8'], '10', ALL);
    expect(result.preferredAction).toBe('split');
    expect(result.fallbackAction).toBe('hit'); // hard 16 vs 10
  });

  it('split unavailable resolves to the non-pair action', () => {
    // 8-8 vs 10 without split = hard 16 vs 10 → hit.
    expect(rec(['8', '8'], '10', NO_SPLIT).preferredAction).toBe('hit');
    // 8-8 vs 6 without split = hard 16 vs 6 → stand.
    expect(rec(['8', '8'], '6', NO_SPLIT).preferredAction).toBe('stand');
    // A-A without split = soft 12 → hit.
    expect(rec(['A', 'A'], '6', NO_SPLIT).preferredAction).toBe('hit');
  });

  it('recommends for split hands (no resplit available)', () => {
    // Split hand 8+8: availability says no split (one-split max) → hard 16 rules.
    expect(rec(['8', '8'], '6', NO_SPLIT, true).preferredAction).toBe('stand');
    // Split hand 8+3 = 11 → double (allowed after split).
    expect(rec(['8', '3'], '6', NO_SPLIT, true).preferredAction).toBe('double');
  });
});
