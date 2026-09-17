import { betUnitsForTrueCount } from '../betting/betRamp';
import { PlayerAction } from '../blackjack/rules';
import { RoundResolution } from '../blackjack/resolve';
import { Card, Rank } from '../cards/card';
import { settleRound } from '../payouts/payouts';
import { indexAction, indexPlayFor, shouldTakeInsurance } from '../strategy/indexPlays';
import { ActionAvailability } from '../strategy/types';
import { ShoeRunLevel, STAR_COUNT, decksRemainingEstimate, trueCountFromDecks } from './training';

/**
 * Beat the Shoe, the pure parts: what each call should have been, the pit
 * boss's heat, the run's stars and the you-versus-flat ledger. The store
 * deals the shoe and asks; everything it grades comes from here.
 */

/** Chips one betting unit stands for on the boss table (even, so 3:2 pays whole chips). */
export const SHOE_RUN_UNIT_CHIPS = 10;

/** The true count a counter works from at the table: running count ÷ the decks they can see, rounded down. */
export function tableTrueCount(runningCount: number, cardsRemaining: number): number {
  return trueCountFromDecks(runningCount, decksRemainingEstimate(cardsRemaining));
}

/** The bet the ramp calls for, in units. */
export function expectedBetUnits(runningCount: number, cardsRemaining: number): number {
  return betUnitsForTrueCount(tableTrueCount(runningCount, cardsRemaining));
}

/**
 * The bet to put out: the ramp's, but with the pit boss watching never more
 * than double the last bet — a counter climbs to a big count over a few
 * hands rather than leaping to it.
 */
export function expectedBet(
  runningCount: number,
  cardsRemaining: number,
  lastUnits: number,
  heatWatched: boolean,
): number {
  const ramp = expectedBetUnits(runningCount, cardsRemaining);
  return heatWatched ? Math.min(ramp, Math.max(1, lastUnits) * 2) : ramp;
}

export function expectedInsurance(runningCount: number, cardsRemaining: number): boolean {
  return shouldTakeInsurance(tableTrueCount(runningCount, cardsRemaining));
}

/**
 * The index play for this hand, when the spot is one — the call graded on a
 * boss with index plays. Null when the chart alone decides (not graded).
 */
export function expectedIndexPlay(
  cards: readonly Pick<Card, 'rank'>[],
  dealerUp: Rank,
  runningCount: number,
  cardsRemaining: number,
  availability: ActionAvailability,
): PlayerAction | null {
  const play = indexPlayFor(cards, dealerUp);
  if (!play) {
    return null;
  }
  return indexAction(play, tableTrueCount(runningCount, cardsRemaining), availability);
}

// ---------------------------------------------------------------------------
// Heat
// ---------------------------------------------------------------------------

/** Heat at which the pit boss backs the player off. */
export const HEAT_LIMIT = 100;
/** Heat that cools off every hand. */
export const HEAT_COOLING = 6;
/** Heat per unit of jump beyond doubling the last bet. */
export const HEAT_PER_JUMP = 18;

/**
 * Heat after a bet: it cools a little each hand, and a bet more than double
 * the last one draws heat for every unit of the jump beyond doubling — so a
 * ramp that climbs a step or two a hand stays cool, and a leap from one unit
 * to eight gets the player backed off on the spot.
 */
export function heatAfterBet(heat: number, previousUnits: number, units: number): number {
  const cooled = Math.max(0, heat - HEAT_COOLING);
  const jump = previousUnits > 0 ? units / previousUnits : 1;
  const added = jump > 2 ? (jump - 2) * HEAT_PER_JUMP : 0;
  return Math.min(HEAT_LIMIT, Math.round(cooled + added));
}

// ---------------------------------------------------------------------------
// Grading and stars
// ---------------------------------------------------------------------------

export type ShoeRunCallKind = 'count' | 'bet' | 'insurance' | 'play';

export interface ShoeRunCall {
  readonly kind: ShoeRunCallKind;
  readonly right: boolean;
}

export interface ShoeRunScore {
  readonly calls: number;
  readonly right: number;
  /** 0–1; a run with no graded calls reads as 1. */
  readonly accuracy: number;
  readonly byKind: Readonly<Record<ShoeRunCallKind, { readonly calls: number; readonly right: number }>>;
}

export function scoreCalls(calls: readonly ShoeRunCall[]): ShoeRunScore {
  const byKind = {
    count: { calls: 0, right: 0 },
    bet: { calls: 0, right: 0 },
    insurance: { calls: 0, right: 0 },
    play: { calls: 0, right: 0 },
  };
  let right = 0;
  for (const call of calls) {
    byKind[call.kind].calls += 1;
    if (call.right) {
      byKind[call.kind].right += 1;
      right += 1;
    }
  }
  return { calls: calls.length, right, accuracy: calls.length === 0 ? 1 : right / calls.length, byKind };
}

/**
 * Stars for a finished run: one for seeing the shoe out, the clear for the
 * level's accuracy, the third for its perfect mark. Backed off, none.
 */
export function shoeRunStars(spec: ShoeRunLevel, accuracy: number, backedOff: boolean): number {
  if (backedOff) {
    return 0;
  }
  if (accuracy >= spec.perfectAccuracy) {
    return STAR_COUNT;
  }
  return accuracy >= spec.clearAccuracy ? 2 : 1;
}

// ---------------------------------------------------------------------------
// You versus the flat bettor
// ---------------------------------------------------------------------------

/**
 * One hand's result in units, for the player and for a flat bettor who
 * played the same cards the same way one unit at a time. Insurance is a
 * side bet of half the stake, paid 2:1 on a dealer blackjack.
 */
export function handUnits(
  resolution: RoundResolution,
  units: number,
  insured: boolean,
): { readonly you: number; readonly flat: number } {
  const profit = settleRound(resolution).totalProfit / SHOE_RUN_UNIT_CHIPS;
  const insurance = insured ? (resolution.dealerHadNatural ? units : -units / 2) : 0;
  const you = profit + insurance;
  return { you, flat: you / Math.max(1, units) };
}
