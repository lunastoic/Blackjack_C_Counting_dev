import { CasinoMap } from '../betting/casino';

/**
 * Guided objectives for Live Table practice. Objectives are small, achievable
 * goals that keep the learner focused on counting while still playing real
 * blackjack. Pure data + evaluation helpers.
 */

export type ObjectiveId =
  | 'track-five-hands'
  | 'call-running-count'
  | 'call-true-count'
  | 'hole-card-patience'
  | 'positive-count-bet'
  | 'cancel-a-pair'
  | 'no-count-check-hints';

export interface TableObjective {
  readonly id: ObjectiveId;
  readonly title: string;
  readonly description: string;
  /** Suggested minimum casino tier (map id 1 = easiest). */
  readonly minMapId: number;
  /** Suggested maximum casino tier. */
  readonly maxMapId: number;
  /** How many times the objective must be satisfied to complete. */
  readonly target: number;
}

export const TABLE_OBJECTIVES: readonly TableObjective[] = [
  {
    id: 'track-five-hands',
    title: 'Track 5 Hands',
    description: 'Keep the running count accurate through five complete hands.',
    minMapId: 1,
    maxMapId: 6,
    target: 5,
  },
  {
    id: 'call-running-count',
    title: 'Call the Running Count',
    description: 'Correctly answer a post-hand running-count check.',
    minMapId: 1,
    maxMapId: 3,
    target: 1,
  },
  {
    id: 'call-true-count',
    title: 'Call the True Count',
    description: 'Correctly answer a post-hand true-count check.',
    minMapId: 2,
    maxMapId: 6,
    target: 1,
  },
  {
    id: 'hole-card-patience',
    title: 'Hole Card Patience',
    description: 'Finish a hand without counting the dealer hole card early.',
    minMapId: 1,
    maxMapId: 6,
    target: 1,
  },
  {
    id: 'positive-count-bet',
    title: 'Bet the Edge',
    description: 'Place a larger bet when the true count is +2 or higher.',
    minMapId: 2,
    maxMapId: 6,
    target: 1,
  },
  {
    id: 'cancel-a-pair',
    title: 'Cancel a Pair',
    description: 'Spot a dealt high/low pair that cancels to 0 and call it out mentally.',
    minMapId: 1,
    maxMapId: 6,
    target: 3,
  },
  {
    id: 'no-count-check-hints',
    title: 'Count from Memory',
    description: 'Answer a count check correctly without tapping the meter to reveal.',
    minMapId: 3,
    maxMapId: 6,
    target: 2,
  },
] as const;

export const OBJECTIVE_BY_ID: Readonly<Record<ObjectiveId, TableObjective>> = Object.fromEntries(
  TABLE_OBJECTIVES.map((obj) => [obj.id, obj]),
) as Readonly<Record<ObjectiveId, TableObjective>>;

export function objectiveById(id: ObjectiveId): TableObjective | undefined {
  return OBJECTIVE_BY_ID[id];
}

/** Pick 1–3 objectives appropriate for the current casino. */
export function objectivesForMap(map: CasinoMap): readonly TableObjective[] {
  return TABLE_OBJECTIVES.filter((obj) => map.id >= obj.minMapId && map.id <= obj.maxMapId).slice(
    0,
    3,
  );
}
