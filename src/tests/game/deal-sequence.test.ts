import { RoundEvent } from '../../engine/blackjack/round';
import { cardsOf } from '../../engine/testing/fixtures';
import {
  cardFanOverlap,
  cardRowStep,
  countEventForInitialDealStep,
  initialDealVisibleCounts,
  INITIAL_DEAL_CARD_COUNT,
} from '../../utils/dealSequence';

describe('deal sequence helpers', () => {
  it('reveals cards in player → dealer → player → dealer order', () => {
    expect(initialDealVisibleCounts(0)).toEqual({ player: 0, dealer: 0 });
    expect(initialDealVisibleCounts(1)).toEqual({ player: 1, dealer: 0 });
    expect(initialDealVisibleCounts(2)).toEqual({ player: 1, dealer: 1 });
    expect(initialDealVisibleCounts(3)).toEqual({ player: 2, dealer: 1 });
    expect(initialDealVisibleCounts(4)).toEqual({ player: 2, dealer: 2 });
    expect(initialDealVisibleCounts(INITIAL_DEAL_CARD_COUNT)).toEqual({ player: 2, dealer: 2 });
  });

  it('applies count only on face-up deal steps', () => {
    const [p1, p2, up] = cardsOf('5', '6', '4');
    const events: RoundEvent[] = [
      { type: 'cardBecameVisible', card: p1, source: 'deal' },
      { type: 'cardBecameVisible', card: p2, source: 'deal' },
      { type: 'cardBecameVisible', card: up, source: 'deal' },
    ];
    const step1 = countEventForInitialDealStep(events, 1);
    const step3 = countEventForInitialDealStep(events, 3);
    const step4 = countEventForInitialDealStep(events, 4);
    expect(step1?.type === 'cardBecameVisible' && step1.card.rank).toBe('5');
    expect(countEventForInitialDealStep(events, 2)).toBeNull();
    expect(step3?.type === 'cardBecameVisible' && step3.card.rank).toBe('6');
    expect(step4?.type === 'cardBecameVisible' && step4.card.rank).toBe('4');
  });

  it('uses light overlap for 2–3 cards and tighter fan for 4+', () => {
    expect(cardFanOverlap(100, 1)).toBe(0);
    expect(cardFanOverlap(100, 2)).toBe(12);
    expect(cardFanOverlap(100, 3)).toBe(12);
    expect(cardFanOverlap(100, 4)).toBe(38);
    expect(cardFanOverlap(100, 8)).toBe(38);
  });

  it('lays cards a gap apart and tucks in only when the row would overflow', () => {
    expect(cardRowStep(60, 1, 4)).toBe(64);
    expect(cardRowStep(60, 2, 4)).toBe(64);
    // No room given: always the gap.
    expect(cardRowStep(60, 9, 4)).toBe(64);
    // 60 + 64 × 4 = 316 fits in 370; 60 + 64 × 5 = 380 does not.
    expect(cardRowStep(60, 5, 4, 370)).toBe(64);
    expect(cardRowStep(60, 6, 4, 370)).toBe(62);
    // Never tighter than a quarter of the card, even if that overflows.
    expect(cardRowStep(60, 12, 4, 200)).toBe(15);
  });
});
