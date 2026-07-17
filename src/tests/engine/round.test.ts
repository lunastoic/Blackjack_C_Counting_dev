import {
  activeHand,
  allPlayerHandsBusted,
  applyPlayerAction,
  IllegalActionError,
  isPlayerTurnComplete,
  playDealerTurn,
  startRound,
} from '../../engine/blackjack/round';
import { canDouble, canSplit, dealerShouldHit } from '../../engine/blackjack/rules';
import { handValue } from '../../engine/hand/evaluate';
import { dealerHandOf, playerHandOf, riggedShoeOf } from '../../engine/testing/fixtures';

describe('initial deal', () => {
  it('deals player, hole (down), player, upcard (up) in order', () => {
    const shoe = riggedShoeOf('5', 'K', '6', '2');
    const { round, events } = startRound(10, shoe);

    expect(round.playerHands[0].cards.map((c) => c.rank)).toEqual(['5', '6']);
    expect(round.dealerHand.cards.map((c) => c.rank)).toEqual(['K', '2']);
    expect(round.dealerHand.cards[0].visibility).toBe('faceDown'); // hole
    expect(round.dealerHand.cards[1].visibility).toBe('faceUp'); // upcard
    expect(round.dealerHand.holeRevealed).toBe(false);

    const visibleRanks = events
      .filter((e) => e.type === 'cardBecameVisible')
      .map((e) => (e.type === 'cardBecameVisible' ? e.card.rank : ''));
    expect(visibleRanks).toEqual(['5', '6', '2']);
  });

  it('detects a natural blackjack and ends the player turn immediately', () => {
    const shoe = riggedShoeOf('A', '5', 'K', '9');
    const { round, events } = startRound(25, shoe);
    expect(isPlayerTurnComplete(round)).toBe(true);
    expect(events.some((e) => e.type === 'playerTurnComplete')).toBe(true);
  });
});

describe('player actions', () => {
  it('hit adds a card and busts appropriately', () => {
    const shoe = riggedShoeOf('10', '2', '9', '7', 'K');
    const start = startRound(10, shoe);
    const step = applyPlayerAction(start.round, start.shoe, 'hit'); // 19 + K busts
    expect(step.round.playerHands[0].status).toBe('busted');
    expect(isPlayerTurnComplete(step.round)).toBe(true);
  });

  it('stand ends the hand', () => {
    const shoe = riggedShoeOf('10', '2', '9', '7');
    const start = startRound(10, shoe);
    const step = applyPlayerAction(start.round, start.shoe, 'stand');
    expect(step.round.playerHands[0].status).toBe('stood');
    expect(isPlayerTurnComplete(step.round)).toBe(true);
  });

  it('a hand reaching exactly 21 auto-advances', () => {
    const shoe = riggedShoeOf('10', '2', '9', '7', '2');
    const start = startRound(10, shoe);
    const step = applyPlayerAction(start.round, start.shoe, 'hit'); // 19 + 2 = 21
    expect(step.round.playerHands[0].status).toBe('stood');
    expect(isPlayerTurnComplete(step.round)).toBe(true);
  });

  it('double takes exactly one card, doubles the bet, and ends the hand', () => {
    const shoe = riggedShoeOf('6', '2', '5', '7', '9');
    const start = startRound(10, shoe);
    const step = applyPlayerAction(start.round, start.shoe, 'double');
    const hand = step.round.playerHands[0];
    expect(hand.bet).toBe(20);
    expect(hand.isDoubled).toBe(true);
    expect(hand.cards).toHaveLength(3);
    expect(hand.status).toBe('stood');
    expect(isPlayerTurnComplete(step.round)).toBe(true);
  });

  it('double requires exactly two cards', () => {
    const shoe = riggedShoeOf('2', '2', '3', '7', '4');
    const start = startRound(10, shoe);
    const afterHit = applyPlayerAction(start.round, start.shoe, 'hit');
    expect(() => applyPlayerAction(afterHit.round, afterHit.shoe, 'double')).toThrow(
      IllegalActionError,
    );
    expect(canDouble(afterHit.round.playerHands[0])).toBe(false);
  });

  it('acting after the player turn completes throws', () => {
    const shoe = riggedShoeOf('10', '2', '9', '7');
    const start = startRound(10, shoe);
    const step = applyPlayerAction(start.round, start.shoe, 'stand');
    expect(() => applyPlayerAction(step.round, step.shoe, 'hit')).toThrow(IllegalActionError);
  });
});

describe('splitting', () => {
  it('splits equal-value cards (10 + K) into two hands with follow-up cards', () => {
    const shoe = riggedShoeOf('10', '5', 'K', '9', '2', '3');
    const start = startRound(10, shoe);
    expect(canSplit(start.round.playerHands[0], false)).toBe(true);

    const step = applyPlayerAction(start.round, start.shoe, 'split');
    expect(step.round.playerHands).toHaveLength(2);
    expect(step.round.splitUsed).toBe(true);
    // Right hand keeps the first card and gets the first follow-up.
    expect(step.round.playerHands[0].cards.map((c) => c.rank)).toEqual(['10', '2']);
    expect(step.round.playerHands[1].cards.map((c) => c.rank)).toEqual(['K', '3']);
    expect(step.round.playerHands.every((h) => h.isFromSplit)).toBe(true);
    expect(step.round.playerHands.every((h) => h.bet === 10)).toBe(true);
  });

  it('plays the right split hand (index 0) first, then the left', () => {
    const shoe = riggedShoeOf('8', '5', '8', '9', '2', '3');
    const start = startRound(10, shoe);
    const split = applyPlayerAction(start.round, start.shoe, 'split');
    expect(split.round.activeHandIndex).toBe(0);

    const standRight = applyPlayerAction(split.round, split.shoe, 'stand');
    expect(standRight.round.activeHandIndex).toBe(1);
    expect(standRight.events).toContainEqual({ type: 'handAdvanced', toHandIndex: 1 });

    const standLeft = applyPlayerAction(standRight.round, standRight.shoe, 'stand');
    expect(isPlayerTurnComplete(standLeft.round)).toBe(true);
  });

  it('enforces the one-split maximum', () => {
    // Right split hand becomes 8 + 8 again but cannot resplit.
    const shoe = riggedShoeOf('8', '5', '8', '9', '8', '3');
    const start = startRound(10, shoe);
    const split = applyPlayerAction(start.round, start.shoe, 'split');
    const rightHand = activeHand(split.round);
    expect(rightHand?.cards.map((c) => c.rank)).toEqual(['8', '8']);
    expect(canSplit(rightHand!, split.round.splitUsed)).toBe(false);
    expect(() => applyPlayerAction(split.round, split.shoe, 'split')).toThrow(IllegalActionError);
  });

  it('rejects splitting unequal values', () => {
    const shoe = riggedShoeOf('10', '5', '9', '9');
    const start = startRound(10, shoe);
    expect(() => applyPlayerAction(start.round, start.shoe, 'split')).toThrow(IllegalActionError);
  });

  it('allows double after split (per hand)', () => {
    const shoe = riggedShoeOf('8', '5', '8', '9', '2', '3', '10');
    const start = startRound(10, shoe);
    const split = applyPlayerAction(start.round, start.shoe, 'split');
    // Right hand 8+2=10 → double draws one card and advances to the left hand.
    const doubled = applyPlayerAction(split.round, split.shoe, 'double');
    expect(doubled.round.playerHands[0].isDoubled).toBe(true);
    expect(doubled.round.playerHands[0].bet).toBe(20);
    expect(doubled.round.activeHandIndex).toBe(1);
  });

  it('a split hand dealt 21 auto-advances', () => {
    // Split aces: right gets K (21) → auto-stand → left active.
    const shoe = riggedShoeOf('A', '5', 'A', '9', 'K', '4');
    const start = startRound(10, shoe);
    const split = applyPlayerAction(start.round, start.shoe, 'split');
    expect(split.round.playerHands[0].status).toBe('stood');
    expect(split.round.activeHandIndex).toBe(1);
  });
});

describe('dealer play', () => {
  it('stands on soft 17', () => {
    expect(dealerShouldHit(dealerHandOf('A', '6', true))).toBe(false);
    const shoe = riggedShoeOf('10', 'A', '10', '6');
    const start = startRound(10, shoe);
    const stood = applyPlayerAction(start.round, start.shoe, 'stand');
    const dealer = playDealerTurn(stood.round, stood.shoe);
    expect(dealer.round.dealerHand.cards).toHaveLength(2); // no draws
    expect(handValue(dealer.round.dealerHand)).toEqual({ total: 17, isSoft: true });
  });

  it('hits soft 16', () => {
    expect(dealerShouldHit(dealerHandOf('A', '5', true))).toBe(true);
    const shoe = riggedShoeOf('10', 'A', '10', '5', '5');
    const start = startRound(10, shoe);
    const stood = applyPlayerAction(start.round, start.shoe, 'stand');
    const dealer = playDealerTurn(stood.round, stood.shoe);
    expect(dealer.round.dealerHand.cards).toHaveLength(3);
    expect(handValue(dealer.round.dealerHand).total).toBe(21);
  });

  it('hits below 17 until standing', () => {
    const shoe = riggedShoeOf('10', '2', '9', '4', '5', '6');
    const start = startRound(10, shoe);
    const stood = applyPlayerAction(start.round, start.shoe, 'stand');
    const dealer = playDealerTurn(stood.round, stood.shoe);
    // 2 + 4 = 6, draws 5 (11), draws 6 (17) → stand.
    expect(handValue(dealer.round.dealerHand).total).toBe(17);
  });

  it('reveals the hole card and emits its visibility event', () => {
    const shoe = riggedShoeOf('10', 'K', '9', '8');
    const start = startRound(10, shoe);
    const stood = applyPlayerAction(start.round, start.shoe, 'stand');
    const dealer = playDealerTurn(stood.round, stood.shoe);
    expect(dealer.round.dealerHand.holeRevealed).toBe(true);
    expect(dealer.round.dealerHand.cards[0].visibility).toBe('faceUp');
    expect(dealer.events[0]).toMatchObject({ type: 'cardBecameVisible', source: 'holeReveal' });
  });

  it('only reveals the hole card when every player hand busted', () => {
    const shoe = riggedShoeOf('10', '2', '9', '4', 'K');
    const start = startRound(10, shoe);
    const busted = applyPlayerAction(start.round, start.shoe, 'hit'); // 19 + K = bust
    expect(allPlayerHandsBusted(busted.round)).toBe(true);

    const dealer = playDealerTurn(busted.round, busted.shoe);
    expect(dealer.round.dealerHand.holeRevealed).toBe(true);
    expect(dealer.round.dealerHand.cards).toHaveLength(2); // 2+4=6 but NO draws
  });
});

describe('rule guards outside the round controller', () => {
  it('canDouble is false on stood/busted hands', () => {
    expect(canDouble(playerHandOf(['10', '5'], { status: 'stood' }))).toBe(false);
    expect(canDouble(playerHandOf(['10', '5']))).toBe(true);
  });

  it('canSplit rejects hands already from a split', () => {
    expect(canSplit(playerHandOf(['8', '8'], { isFromSplit: true }), true)).toBe(false);
  });
});
