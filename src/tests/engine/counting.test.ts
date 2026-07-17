import { RANKS, Rank } from '../../engine/cards/card';
import {
  applyVisibleCard,
  applyVisibleCards,
  createCount,
  hiLoValue,
  resetCount,
} from '../../engine/counting/hiLo';
import { roundToNearestHalf, trueCount } from '../../engine/counting/trueCount';
import { cardsOf, riggedShoeOf } from '../../engine/testing/fixtures';
import { startRound, playDealerTurn } from '../../engine/blackjack/round';
import { CountState } from '../../engine/counting/hiLo';
import { RoundEvent } from '../../engine/blackjack/round';

function applyEvents(count: CountState, events: readonly RoundEvent[]): CountState {
  let current = count;
  for (const event of events) {
    if (event.type === 'cardBecameVisible') {
      current = applyVisibleCard(current, event.card.rank);
    }
  }
  return current;
}

describe('running count', () => {
  it('has the correct Hi-Lo value for every rank', () => {
    for (const rank of RANKS) {
      const state = applyVisibleCard(createCount(), rank as Rank);
      expect(state.runningCount).toBe(hiLoValue(rank as Rank));
    }
  });

  it('accumulates over visible cards', () => {
    const state = applyVisibleCards(createCount(), cardsOf('2', '3', 'K', '7', '5'));
    // +1 +1 −1 0 +1 = +2
    expect(state.runningCount).toBe(2);
  });

  it('is not clamped to ±10', () => {
    const lows = Array.from({ length: 15 }, () => '4' as Rank);
    const state = applyVisibleCards(createCount(), cardsOf(...lows));
    expect(state.runningCount).toBe(15);
  });

  it('resets to 0 on shuffle', () => {
    const state = applyVisibleCards(createCount(), cardsOf('2', '3', '4'));
    expect(state.runningCount).toBe(3);
    expect(resetCount().runningCount).toBe(0);
  });
});

describe('dealer hole card visibility', () => {
  // Deal order: player, HOLE (down), player, upcard.
  // Ranks: player 5 (+1), hole K (−1 later), player 6 (+1), upcard 2 (+1).
  it('excludes the hidden hole card from the count', () => {
    const shoe = riggedShoeOf('5', 'K', '6', '2');
    const { events } = startRound(10, shoe);
    const count = applyEvents(createCount(), events);
    // 5 + 6 + 2 visible = +3; hole K not counted.
    expect(count.runningCount).toBe(3);
  });

  it('includes the hole card immediately after the reveal', () => {
    const shoe = riggedShoeOf('5', 'K', '6', '2', '9');
    const start = startRound(10, shoe);
    let count = applyEvents(createCount(), start.events);

    const dealer = playDealerTurn(start.round, start.shoe);
    count = applyEvents(count, dealer.events);
    // Hole K now counted (−1): 3 − 1 = 2, plus any dealer draws (9 counts 0).
    expect(count.runningCount).toBe(2);
  });
});

describe('true count', () => {
  it('divides by decks remaining (cardsRemaining / 52)', () => {
    expect(trueCount(6, 156)).toBe(2); // 3 decks remaining
    expect(trueCount(4, 104)).toBe(2); // 2 decks remaining
    expect(trueCount(-6, 156)).toBe(-2);
  });

  it('rounds to the nearest 0.5', () => {
    expect(trueCount(5, 104)).toBe(2.5); // 5 / 2 = 2.5
    expect(trueCount(5, 156)).toBe(1.5); // 1.666… → 1.5
    expect(trueCount(7, 156)).toBe(2.5); // 2.333… → 2.5
    expect(roundToNearestHalf(2.24)).toBe(2);
    expect(roundToNearestHalf(2.25)).toBe(2.5);
    expect(roundToNearestHalf(-1.3)).toBe(-1.5);
  });

  it('amplifies with a nearly-empty shoe without clamping', () => {
    expect(trueCount(12, 26)).toBe(24); // half a deck remaining
  });

  it('is protected against division by zero', () => {
    expect(trueCount(8, 0)).toBe(0);
    expect(trueCount(8, -1)).toBe(0);
    expect(Number.isFinite(trueCount(8, 0))).toBe(true);
  });
});
