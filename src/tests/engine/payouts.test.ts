import { resolveHand, resolveRound } from '../../engine/blackjack/resolve';
import {
  blackjackProfit,
  payoutForResult,
  settleHand,
  settleRound,
} from '../../engine/payouts/payouts';
import { dealerHandOf, playerHandOf } from '../../engine/testing/fixtures';
import { applyPlayerAction, startRound } from '../../engine/blackjack/round';
import { playDealerTurn } from '../../engine/blackjack/round';
import { riggedShoeOf } from '../../engine/testing/fixtures';

describe('hand resolution', () => {
  const dealer19 = dealerHandOf('9', '10', true);

  it('player bust loses even if dealer would bust', () => {
    const busted = playerHandOf(['10', '9', '5'], { status: 'busted' });
    expect(resolveHand(busted, dealerHandOf('10', '6', true))).toBe('loss');
  });

  it('higher total wins, lower loses, equal pushes', () => {
    expect(resolveHand(playerHandOf(['10', 'K']), dealer19)).toBe('win');
    expect(resolveHand(playerHandOf(['10', '8']), dealer19)).toBe('loss');
    expect(resolveHand(playerHandOf(['10', '9']), dealer19)).toBe('push');
  });

  it('dealer bust is a player win', () => {
    const dealerBust = {
      ...dealerHandOf('10', '6', true),
    };
    const withDraw = { ...dealerBust, cards: [...dealerBust.cards, ...playerHandOf(['K']).cards] };
    expect(resolveHand(playerHandOf(['10', '2']), withDraw)).toBe('win');
  });

  it('natural blackjack beats a non-natural 21', () => {
    const dealer21in3 = {
      ...dealerHandOf('5', '6', true),
      cards: [...dealerHandOf('5', '6', true).cards, ...playerHandOf(['10']).cards],
    };
    expect(resolveHand(playerHandOf(['A', 'K']), dealer21in3)).toBe('blackjack');
  });

  it('both naturals push; dealer natural beats 21-in-3', () => {
    const dealerNatural = dealerHandOf('A', 'K', true);
    expect(resolveHand(playerHandOf(['A', 'Q']), dealerNatural)).toBe('push');
    expect(resolveHand(playerHandOf(['7', '7', '7']), dealerNatural)).toBe('loss');
  });

  it('a split-hand 21 is a plain win, not a blackjack', () => {
    const splitHand = playerHandOf(['A', 'K'], { isFromSplit: true });
    expect(resolveHand(splitHand, dealer19)).toBe('win');
  });
});

describe('payout amounts (totalReturned = stake + winnings)', () => {
  it('natural blackjack pays 3:2', () => {
    expect(payoutForResult('blackjack', 100)).toBe(250); // 100 stake + 150 profit
    expect(blackjackProfit(100)).toBe(150);
  });

  it('odd blackjack wagers floor the profit (documented rule)', () => {
    expect(blackjackProfit(5)).toBe(7); // 7.5 → 7
    expect(payoutForResult('blackjack', 5)).toBe(12);
    expect(Number.isInteger(payoutForResult('blackjack', 3))).toBe(true);
  });

  it('normal win pays 1:1', () => {
    expect(payoutForResult('win', 100)).toBe(200);
  });

  it('push returns the wager', () => {
    expect(payoutForResult('push', 100)).toBe(100);
  });

  it('loss pays zero', () => {
    expect(payoutForResult('loss', 100)).toBe(0);
  });

  it('rejects non-integer wagers', () => {
    expect(() => payoutForResult('win', 10.5)).toThrow(RangeError);
  });
});

describe('settlement', () => {
  it('doubled wins pay on the doubled wager', () => {
    // Hard 11 double: bet 10 → 20; win returns 40 (profit +20).
    const shoe = riggedShoeOf('6', '6', '5', 'K', '9', '10');
    const start = startRound(10, shoe);
    const doubled = applyPlayerAction(start.round, start.shoe, 'double'); // 11 + 9 = 20
    const dealer = playDealerTurn(doubled.round, doubled.shoe); // 6 + K = 16 → draws 10 → bust
    const payout = settleRound(resolveRound(dealer.round));
    expect(payout.hands[0].wager).toBe(20);
    expect(payout.hands[0].totalReturned).toBe(40);
    expect(payout.totalProfit).toBe(20);
  });

  it('split-hand 21 settles at 1:1', () => {
    const resolution = {
      handId: 'h',
      result: 'win' as const,
      bet: 50,
      wasDoubled: false,
      wasSplitHand: true,
      playerBusted: false,
    };
    expect(settleHand(resolution).totalReturned).toBe(100);
  });

  it('settles multiple split hands independently', () => {
    // Split 8s vs dealer 19: right hand 8+K stands at 18 (loss), left 8+3 hit to 21 (win).
    const shoe = riggedShoeOf('8', '9', '8', '10', 'K', '3', 'K');
    const start = startRound(25, shoe);
    const split = applyPlayerAction(start.round, start.shoe, 'split');
    const standRight = applyPlayerAction(split.round, split.shoe, 'stand'); // 18
    const hitLeft = applyPlayerAction(standRight.round, standRight.shoe, 'hit'); // 8+3+K = 21
    const dealer = playDealerTurn(hitLeft.round, hitLeft.shoe); // 9 + 10 = 19
    const payout = settleRound(resolveRound(dealer.round));

    expect(payout.hands).toHaveLength(2);
    expect(payout.hands[0].result).toBe('loss');
    expect(payout.hands[0].totalReturned).toBe(0);
    expect(payout.hands[1].result).toBe('win'); // 21 on split hand: 1:1, NOT 3:2
    expect(payout.hands[1].totalReturned).toBe(50);
    expect(payout.totalReturned).toBe(50);
    expect(payout.totalProfit).toBe(0);
  });
});
