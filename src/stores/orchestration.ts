import { AchievementUnlockEvent } from '../engine/achievements/engine';
import { GameplayEvent } from '../engine/achievements/events';
import { ProgressionResult } from '../engine/progression/progression';
import { useAchievementStore } from './achievementStore';
import { useEconomyStore } from './economyStore';
import { useProgressionStore } from './progressionStore';

/**
 * ORCHESTRATION RULE: stores never import each other. Any action that spans
 * multiple stores (XP → level-up chips → achievement events) goes through the
 * explicit functions in this module, so every cross-store side effect is
 * discoverable in one place.
 */

export interface XpAwardOutcome {
  readonly progression: ProgressionResult;
  readonly unlocked: readonly AchievementUnlockEvent[];
}

/**
 * Awards XP, credits any level-up chip reward to the economy, and reports
 * LEVEL_REACHED to the achievement engine.
 */
export function awardXpWithRewards(xpAmount: number): XpAwardOutcome {
  const progression = useProgressionStore.getState().awardXp(xpAmount);

  if (progression.chipReward > 0) {
    useEconomyStore.getState().creditChips(progression.chipReward);
  }

  let unlocked: readonly AchievementUnlockEvent[] = [];
  if (progression.levelsGained > 0) {
    unlocked = useAchievementStore.getState().applyEvent({
      type: 'LEVEL_REACHED',
      level: progression.newLevel,
    });
  }

  return { progression, unlocked };
}

/** Single entry point for gameplay events feeding stats/achievements. */
export function recordGameplayEvent(
  event: GameplayEvent,
  mapId?: number,
): readonly AchievementUnlockEvent[] {
  return useAchievementStore.getState().applyEvent(event, mapId);
}
