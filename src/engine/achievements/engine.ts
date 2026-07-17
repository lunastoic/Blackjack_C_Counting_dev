import { AchievementDefinition, AchievementProgress } from './definitions';
import { GameplayEvent } from './events';
import { applyEventToStats, LifetimeStats, INITIAL_STATS } from './stats';

export interface AchievementsState {
  readonly stats: LifetimeStats;
  /** Ids already unlocked — an id in this list can never unlock (or reward) again. */
  readonly unlockedIds: readonly string[];
}

export const INITIAL_ACHIEVEMENTS_STATE: AchievementsState = {
  stats: INITIAL_STATS,
  unlockedIds: [],
};

/** Structured unlock notification for future UI toasts. */
export interface AchievementUnlockEvent {
  readonly achievementId: string;
  readonly title: string;
  readonly description: string;
}

export interface ProcessEventResult {
  readonly state: AchievementsState;
  readonly newlyUnlocked: readonly AchievementUnlockEvent[];
}

export function progressFor(
  definition: Pick<AchievementDefinition, 'id' | 'statKey' | 'goal'>,
  state: AchievementsState,
): AchievementProgress {
  const raw = state.stats[definition.statKey];
  return {
    id: definition.id,
    current: Math.min(raw, definition.goal),
    goal: definition.goal,
    unlocked: state.unlockedIds.includes(definition.id),
  };
}

/**
 * Folds one gameplay event into the stats and reports any achievements that
 * crossed their goal. Already-unlocked ids are skipped, so unlocks (and their
 * future rewards) are idempotent even if the same event is processed again.
 */
export function processEvent(
  state: AchievementsState,
  event: GameplayEvent,
  catalog: readonly AchievementDefinition[],
): ProcessEventResult {
  const stats = applyEventToStats(state.stats, event);

  const newlyUnlocked: AchievementUnlockEvent[] = [];
  const unlockedIds = [...state.unlockedIds];
  for (const definition of catalog) {
    if (unlockedIds.includes(definition.id)) {
      continue;
    }
    if (stats[definition.statKey] >= definition.goal) {
      unlockedIds.push(definition.id);
      newlyUnlocked.push({
        achievementId: definition.id,
        title: definition.title,
        description: definition.description,
      });
    }
  }

  return { state: { stats, unlockedIds }, newlyUnlocked };
}

export function processEvents(
  state: AchievementsState,
  events: readonly GameplayEvent[],
  catalog: readonly AchievementDefinition[],
): ProcessEventResult {
  let current = state;
  const newlyUnlocked: AchievementUnlockEvent[] = [];
  for (const event of events) {
    const result = processEvent(current, event, catalog);
    current = result.state;
    newlyUnlocked.push(...result.newlyUnlocked);
  }
  return { state: current, newlyUnlocked };
}
