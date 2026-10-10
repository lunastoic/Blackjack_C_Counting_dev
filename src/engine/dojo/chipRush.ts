import { betUnitsForTrueCount, BET_SPREAD_MAX } from '../betting/betRamp';
import { defaultRng, Rng } from '../shoe/rng';
import type { ChipRushLevel } from './training';

/**
 * Chip Rush — Ganymede's level 2. True-count cards slide along a lane toward
 * a red edge; the player drops the right bet (in units) on the front card
 * before it escapes. Pure TypeScript — no React / RN imports.
 */

/** True counts dealt on the lane: a cold shoe up to past the top of the spread. */
export const CHIP_RUSH_TC_MIN = -2;
export const CHIP_RUSH_TC_MAX = 9;

/** Bet stacks in the tray: 1 to the top of the spread. */
export const CHIP_RUSH_STACKS: readonly number[] = Array.from({ length: BET_SPREAD_MAX }, (_, i) => i + 1);

/** A new card joins the lane after this share of a crossing. */
export const CHIP_RUSH_SPAWN_SHARE = 0.5;

/** Time one card takes to cross the lane on this wave (0-based), easing from start to end. */
export function chipRushCrossMs(
  spec: Pick<ChipRushLevel, 'waves' | 'crossMsStart' | 'crossMsEnd'>,
  wave: number,
): number {
  if (spec.waves <= 1) {
    return spec.crossMsStart;
  }
  const t = Math.min(1, Math.max(0, wave / (spec.waves - 1)));
  return Math.round(spec.crossMsStart + (spec.crossMsEnd - spec.crossMsStart) * t);
}

/** A true count for the lane. */
export function chipRushTrueCount(rng: Rng = defaultRng): number {
  const span = CHIP_RUSH_TC_MAX - CHIP_RUSH_TC_MIN + 1;
  return CHIP_RUSH_TC_MIN + Math.floor(rng() * span);
}

/** The bet a card asks for. */
export function chipRushBet(trueCount: number): number {
  return betUnitsForTrueCount(trueCount);
}
