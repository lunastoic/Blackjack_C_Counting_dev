import { HandResolution, HandResult, RoundResolution } from '../blackjack/resolve';

/**
 * PAYOUT CONVENTION (used everywhere in this codebase):
 *
 * The wager was already deducted from the bankroll when the bet was placed, so
 * `totalReturned` is the TOTAL AMOUNT CREDITED back to the bankroll when the
 * round settles — stake plus winnings. `profit` is the round's net effect
 * relative to before the bet was placed (totalReturned − wager).
 *
 *   loss:      totalReturned = 0            (profit −wager)
 *   push:      totalReturned = wager        (profit 0)
 *   win:       totalReturned = 2 × wager    (profit +wager, includes split-hand 21 and doubles)
 *   blackjack: totalReturned = wager + floor(wager × 3 / 2)
 *
 * ODD-WAGER RULE: the spec does not define 3:2 payouts for odd wagers, so the
 * deterministic rule is integer floor on the profit: bet 5 → profit 7
 * (not 7.5). Chip balances stay integers everywhere; no floating point.
 */

export interface PayoutResult {
  readonly handId: string;
  readonly result: HandResult;
  readonly wager: number;
  /** Chips credited back to the bankroll (stake + winnings). */
  readonly totalReturned: number;
  /** Net chips relative to before the bet was placed. */
  readonly profit: number;
}

export interface RoundPayout {
  readonly hands: readonly PayoutResult[];
  readonly totalReturned: number;
  readonly totalProfit: number;
}

export function blackjackProfit(wager: number): number {
  return Math.floor((wager * 3) / 2);
}

export function payoutForResult(result: HandResult, wager: number): number {
  if (!Number.isInteger(wager) || wager < 0) {
    throw new RangeError(`Wager must be a non-negative integer, got ${wager}`);
  }
  switch (result) {
    case 'blackjack':
      return wager + blackjackProfit(wager);
    case 'win':
      return wager * 2;
    case 'push':
      return wager;
    case 'loss':
      return 0;
  }
}

export function settleHand(resolution: HandResolution): PayoutResult {
  const totalReturned = payoutForResult(resolution.result, resolution.bet);
  return {
    handId: resolution.handId,
    result: resolution.result,
    wager: resolution.bet,
    totalReturned,
    profit: totalReturned - resolution.bet,
  };
}

/** Settles every hand in the round (both split hands when present). */
export function settleRound(resolution: RoundResolution): RoundPayout {
  const hands = resolution.hands.map(settleHand);
  return {
    hands,
    totalReturned: hands.reduce((sum, hand) => sum + hand.totalReturned, 0),
    totalProfit: hands.reduce((sum, hand) => sum + hand.profit, 0),
  };
}
