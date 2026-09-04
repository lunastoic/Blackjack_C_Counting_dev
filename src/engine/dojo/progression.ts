import { awardXp, PlayerProgress, ProgressionResult } from '../progression/progression';
import { LessonId } from './curriculum';

/**
 * Dojo rank progression. Ranks are cosmetic titles earned by completing lessons
 * and drills; they also gate later lessons. XP from the dojo feeds into the
 * main player progression.
 */

export interface DojoRank {
  readonly index: number;
  readonly title: string;
  readonly subtitle: string;
  /** Total XP from dojo activities required to reach this rank. */
  readonly xpRequired: number;
}

export const DOJO_RANKS: readonly DojoRank[] = [
  { index: 0, title: 'White Belt', subtitle: 'First steps at the table', xpRequired: 0 },
  { index: 1, title: 'Yellow Belt', subtitle: 'Values are automatic', xpRequired: 20 },
  { index: 2, title: 'Orange Belt', subtitle: 'Running count is steady', xpRequired: 60 },
  { index: 3, title: 'Green Belt', subtitle: 'True count is sharp', xpRequired: 120 },
  { index: 4, title: 'Blue Belt', subtitle: 'Counting while playing', xpRequired: 200 },
  { index: 5, title: 'Black Belt', subtitle: 'Ready for the casino floor', xpRequired: 300 },
];

export const MAX_DOJO_RANK = DOJO_RANKS[DOJO_RANKS.length - 1].index;

export function rankForXp(totalXp: number): DojoRank {
  let current = DOJO_RANKS[0];
  for (const rank of DOJO_RANKS) {
    if (totalXp >= rank.xpRequired) {
      current = rank;
    } else {
      break;
    }
  }
  return current;
}

export function nextRankForXp(totalXp: number): DojoRank | null {
  const current = rankForXp(totalXp);
  return DOJO_RANKS.find((r) => r.index === current.index + 1) ?? null;
}

export function xpToNextRank(totalXp: number): number {
  const next = nextRankForXp(totalXp);
  if (!next) {
    return 0;
  }
  return Math.max(0, next.xpRequired - totalXp);
}

/** XP payouts for dojo activities. */
export const DOJO_XP = {
  lessonComplete: 10,
  valuesDrill: 8,
  runningDrill: 10,
  speedDrill: 12,
  objectiveComplete: 5,
  flashLevel: 12,
} as const;

export interface DojoProgressionResult {
  readonly dojoXp: number;
  readonly rank: DojoRank;
  readonly didRankUp: boolean;
  readonly progression: ProgressionResult;
}

export function awardDojoXp(
  playerProgress: PlayerProgress,
  currentDojoXp: number,
  amount: number,
): DojoProgressionResult {
  const previousRank = rankForXp(currentDojoXp);
  const dojoXp = currentDojoXp + amount;
  const rank = rankForXp(dojoXp);
  const progression = awardXp(playerProgress, amount);
  return {
    dojoXp,
    rank,
    didRankUp: rank.index > previousRank.index,
    progression,
  };
}

/** Lessons unlock sequentially by rank and previous completion. */
export function isLessonUnlocked(
  lessonId: LessonId,
  completed: ReadonlySet<LessonId>,
  rankIndex: number,
): boolean {
  const ordered = ['hi-lo-values', 'running-count', 'hole-card-rule', 'true-count', 'count-and-play', 'betting-by-count'] as const;
  const index = ordered.indexOf(lessonId);
  if (index === 0) {
    return true;
  }
  const previousId = ordered[index - 1];
  if (!completed.has(previousId)) {
    return false;
  }
  // Each lesson also has a minimum rank gate handled by the curriculum.
  return true;
}

/** Whether the user has finished the full curriculum. */
export function isDojoGraduate(completed: ReadonlySet<LessonId>): boolean {
  const ordered = ['hi-lo-values', 'running-count', 'hole-card-rule', 'true-count', 'count-and-play', 'betting-by-count'] as const;
  return ordered.every((id) => completed.has(id));
}
