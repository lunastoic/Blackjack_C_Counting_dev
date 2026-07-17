import { LifetimeStats } from './stats';

/**
 * Generic stat-driven achievement: unlocks when `stats[statKey] >= goal`.
 * The full 17-achievement catalog is a Milestone 5 deliverable pending the
 * owner decision in docs/IMPLEMENTATION_PLAN.md; this file ships the small
 * Milestone 1 test catalog only.
 */
export interface AchievementDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly statKey: keyof LifetimeStats;
  readonly goal: number;
}

export interface AchievementProgress {
  readonly id: string;
  readonly current: number;
  readonly goal: number;
  readonly unlocked: boolean;
}

export const MILESTONE_1_ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first-blackjack',
    title: 'Natural Talent',
    description: 'Hit your first natural blackjack.',
    statKey: 'blackjacks',
    goal: 1,
  },
  {
    id: 'first-split',
    title: 'Divide and Conquer',
    description: 'Split a pair for the first time.',
    statKey: 'splits',
    goal: 1,
  },
  {
    id: 'first-double',
    title: 'Double or Nothing',
    description: 'Double down for the first time.',
    statKey: 'doubles',
    goal: 1,
  },
  {
    id: 'count-above-10',
    title: 'Hot Shoe',
    description: 'Reach a running count above +10.',
    statKey: 'highestRunningCount',
    goal: 11, // "above +10" — integer counts, so ≥ 11
  },
  {
    id: 'reach-level-5',
    title: 'Regular',
    description: 'Reach level 5.',
    statKey: 'highestLevel',
    goal: 5,
  },
  {
    id: 'first-all-in',
    title: 'No Guts, No Glory',
    description: 'Bet your entire bankroll.',
    statKey: 'allInBets',
    goal: 1,
  },
];
