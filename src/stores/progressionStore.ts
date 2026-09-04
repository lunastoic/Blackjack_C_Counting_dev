import { create } from 'zustand';
import { FEATURES } from '../constants/features';
import { mapById, TableLicense } from '../engine/betting/casino';
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
 *
 * Table licenses (earned in the Count Sprint) live here too: they gate table
 * play per casino and only ever upgrade (none → permit → licensed).
 */
const LICENSE_RANK: Record<TableLicense, number> = { none: 0, permit: 1, licensed: 2 };

interface ProgressionState {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly unlockedMapIds: readonly number[];
  /** mapId → earned table license (missing key = table still closed). */
  readonly licenses: Readonly<Record<number, TableLicense>>;
  /** Applies engine progression; returns the structured result for orchestration. */
  awardXp(amount: number): ProgressionResult;
  isMapUnlocked(mapId: number): boolean;
  /** True when the unlock requirement (see canUnlockMap) is currently met. */
  canUnlockMap(mapId: number): boolean;
  /**
   * Unlocks when the requirement is met. One ladder: a casino opens once the
   * PREVIOUS casino's full license is earned in the Count Sprint. (The old
   * level requirement sits behind FEATURES.levelMapGating.)
   */
  unlockMap(mapId: number): boolean;
  licenseForMap(mapId: number): TableLicense;
  /** Upgrade-only license grant. Returns true when the tier actually rose. */
  grantLicense(mapId: number, license: TableLicense): boolean;
  hydrate(data: SaveData['progression']): void;
}

export const useProgressionStore = create<ProgressionState>()((set, get) => ({
  level: INITIAL_PROGRESS.level,
  xpIntoLevel: INITIAL_PROGRESS.xpIntoLevel,
  unlockedMapIds: [1],
  licenses: {},

  awardXp: (amount) => {
    const result = engineAwardXp(
      { level: get().level, xpIntoLevel: get().xpIntoLevel },
      amount,
    );
    set({ level: result.newLevel, xpIntoLevel: result.newXp });
    return result;
  },

  isMapUnlocked: (mapId) => get().unlockedMapIds.includes(mapId),

  canUnlockMap: (mapId) => {
    const map = mapById(mapId);
    if (!map || get().isMapUnlocked(mapId)) {
      return false;
    }
    if (FEATURES.levelMapGating) {
      return get().level >= map.unlockLevel;
    }
    // Map ids are sequential (1…6): licensing a casino opens the next one.
    const previous = mapById(mapId - 1);
    return !previous || get().licenseForMap(previous.id) === 'licensed';
  },

  unlockMap: (mapId) => {
    if (!get().canUnlockMap(mapId)) {
      return false;
    }
    set((state) => ({ unlockedMapIds: [...state.unlockedMapIds, mapId] }));
    return true;
  },

  licenseForMap: (mapId) => get().licenses[mapId] ?? 'none',

  grantLicense: (mapId, license) => {
    if (!mapById(mapId)) {
      return false;
    }
    const current = get().licenseForMap(mapId);
    if (LICENSE_RANK[license] <= LICENSE_RANK[current]) {
      return false;
    }
    set((state) => ({ licenses: { ...state.licenses, [mapId]: license } }));
    return true;
  },

  hydrate: (data) =>
    set({
      level: data.level,
      xpIntoLevel: data.xpIntoLevel,
      unlockedMapIds: [...data.unlockedMapIds],
      licenses: Object.fromEntries(
        Object.entries(data.licenses ?? {}).map(([mapId, license]) => [Number(mapId), license]),
      ),
    }),
}));
