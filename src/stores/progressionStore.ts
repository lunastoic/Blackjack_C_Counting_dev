import { create } from 'zustand';
import { mapById } from '../engine/betting/casino';
import {
  awardXp as engineAwardXp,
  INITIAL_PROGRESS,
  ProgressionResult,
} from '../engine/progression/progression';
import { SaveData } from '../persistence/schema';

/**
 * Level/XP state. ALL XP math lives in the engine (`awardXp`); this store just
 * holds the result. Chip rewards from level-ups are handed off by the
 * orchestrator (stores/orchestration.ts), not credited here, so the economy
 * store remains the single owner of the balance.
 */
interface ProgressionState {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly unlockedMapIds: readonly number[];
  /** Applies engine progression; returns the structured result for orchestration. */
  awardXp(amount: number): ProgressionResult;
  isMapUnlocked(mapId: number): boolean;
  /** Unlocks when the level requirement is met. Returns success. */
  unlockMap(mapId: number): boolean;
  hydrate(data: SaveData['progression']): void;
}

export const useProgressionStore = create<ProgressionState>()((set, get) => ({
  level: INITIAL_PROGRESS.level,
  xpIntoLevel: INITIAL_PROGRESS.xpIntoLevel,
  unlockedMapIds: [1],

  awardXp: (amount) => {
    const result = engineAwardXp(
      { level: get().level, xpIntoLevel: get().xpIntoLevel },
      amount,
    );
    set({ level: result.newLevel, xpIntoLevel: result.newXp });
    return result;
  },

  isMapUnlocked: (mapId) => get().unlockedMapIds.includes(mapId),

  unlockMap: (mapId) => {
    const map = mapById(mapId);
    if (!map || get().level < map.unlockLevel || get().isMapUnlocked(mapId)) {
      return false;
    }
    set((state) => ({ unlockedMapIds: [...state.unlockedMapIds, mapId] }));
    return true;
  },

  hydrate: (data) =>
    set({
      level: data.level,
      xpIntoLevel: data.xpIntoLevel,
      unlockedMapIds: [...data.unlockedMapIds],
    }),
}));
