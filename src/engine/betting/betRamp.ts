import { floorTrueCount } from '../counting/trueCount';

/** The top of the spread: never more than this many units out. */
export const BET_SPREAD_MAX = 8;

/**
 * Units to bet at a true count — the classic "true count minus one", on the
 * true count rounded down, one unit at the least and the spread's top at the
 * most. +1 or lower → 1, +2 → 1, +3 → 2, +4 → 3 … +9 and up → 8.
 */
export function betUnitsForTrueCount(trueCount: number): number {
  return Math.max(1, Math.min(BET_SPREAD_MAX, floorTrueCount(trueCount) - 1));
}
