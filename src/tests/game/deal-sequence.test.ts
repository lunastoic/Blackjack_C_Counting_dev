import { RoundEvent } from '../../engine/blackjack/round';
import { cardsOf } from '../../engine/testing/fixtures';
import {
  cardFanOverlap,
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
});
