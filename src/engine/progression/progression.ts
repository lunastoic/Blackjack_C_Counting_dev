import { HandResult } from '../blackjack/resolve';

/**
 * XP and leveling (REBUILD_SPEC §9): win 3 XP, push 2 XP, loss 1 XP, correct
 * quiz answer 3 XP; 30 XP per level; max level 25; +1000 chips per level
 * gained. One XP award can produce multiple level-ups.
 *
 * MAX-LEVEL RULE (spec is silent): once level 25 is reached, further XP is
 * discarded — no levels, chips, or banked XP beyond the cap.
 */

export const XP_PER_LEVEL = 30;
export const MAX_LEVEL = 25;
export const CHIPS_PER_LEVEL_UP = 1000;

export const XP_AWARDS = {
  win: 3,
  blackjack: 3, // a natural is a win
  push: 2,
  loss: 1,
  quizCorrect: 3,
} as const;

export function xpForHandResult(result: HandResult): number {
  return XP_AWARDS[result];
}

export interface PlayerProgress {
  /** 1-based level, capped at MAX_LEVEL. */
  readonly level: number;
  /** XP accumulated inside the current level: 0…XP_PER_LEVEL−1 (always 0 at max level). */
  readonly xpIntoLevel: number;
}

export const INITIAL_PROGRESS: PlayerProgress = { level: 1, xpIntoLevel: 0 };

export interface ProgressionResult {
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly previousXp: number;
  readonly newXp: number;
  readonly levelsGained: number;
  /** 1000 chips per level gained; 0 beyond the level cap. */
  readonly chipReward: number;
  readonly progress: PlayerProgress;
}

export function isMaxLevel(progress: PlayerProgress): boolean {
  return progress.level >= MAX_LEVEL;
}

export function awardXp(progress: PlayerProgress, xpAmount: number): ProgressionResult {
  if (!Number.isInteger(xpAmount) || xpAmount < 0) {
    throw new RangeError(`XP award must be a non-negative integer, got ${xpAmount}`);
  }

  const previousLevel = progress.level;
  const previousXp = progress.xpIntoLevel;

  if (isMaxLevel(progress)) {
    return {
      previousLevel,
      newLevel: previousLevel,
      previousXp,
      newXp: previousXp,
      levelsGained: 0,
      chipReward: 0,
      progress,
    };
  }

  let level = progress.level;
  let xp = progress.xpIntoLevel + xpAmount;
  let levelsGained = 0;

  while (xp >= XP_PER_LEVEL && level < MAX_LEVEL) {
    xp -= XP_PER_LEVEL;
    level += 1;
    levelsGained += 1;
  }

  if (level >= MAX_LEVEL) {
    xp = 0; // XP beyond the cap is discarded.
  }

  const next: PlayerProgress = { level, xpIntoLevel: xp };
  return {
    previousLevel,
    newLevel: level,
    previousXp,
    newXp: xp,
    levelsGained,
    chipReward: levelsGained * CHIPS_PER_LEVEL_UP,
    progress: next,
  };
}
