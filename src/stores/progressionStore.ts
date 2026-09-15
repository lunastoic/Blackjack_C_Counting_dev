import { create } from 'zustand';
import { FEATURES } from '../constants/features';
import { mapUnlockCost } from '../constants/mapUnlockCosts';
import { mapById, TableLicense } from '../engine/betting/casino';
import {
  awardXp as engineAwardXp,
  INITIAL_PROGRESS,
  ProgressionResult,
} from '../engine/progression/progression';
import { SaveData } from '../persistence/schema';
import { useEconomyStore } from './economyStore';

/**
 * Level/XP state. ALL XP math lives in the engine (`awardXp`); this store just
 * holds the result. Chip rewards from level-ups are handed off by the
 * orchestrator (stores/orchestration.ts), not credited here, so the economy
 * store remains the single owner of the balance.
 *
 * Table licenses live here too: they gate table play per casino and only ever
 * upgrade (none → permit → licensed). A casino's table opens with the casino —
 * every unlock (earned or bought) lands the full license at the same time.
 */
const LICENSE_RANK: Record<TableLicense, number> = { none: 0, permit: 1, licensed: 2 };

interface ProgressionState {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly unlockedMapIds: readonly number[];
  /** mapId → earned table license (missing key = table still closed). */
  readonly licenses: Readonly<Record<number, TableLicense>>;
  /**
   * Casino unlocked this session whose reveal the Select Map screen has yet
   * to play. Session-only: never saved, so a relaunch shows it simply open.
   */
  readonly pendingRevealMapId: number | null;
  /** Applies engine progression; returns the structured result for orchestration. */
  awardXp(amount: number): ProgressionResult;
  isMapUnlocked(mapId: number): boolean;
  /**
   * True when `mapId` is the next casino on the ladder: still locked, with the
   * previous casino open. (The old level requirement sits behind
   * FEATURES.levelMapGating.)
   */
  canUnlockMap(mapId: number): boolean;
  /**
   * Opens the next casino and its table. The free path — the caller (dojoStore)
   * has just cleared the previous casino's six training levels. Buying the
   * casino early is `buyMap`.
   */
  unlockMap(mapId: number): boolean;
  /**
   * Opens the next casino early for its chip price (constants/mapUnlockCosts).
   * Only access changes hands: the previous casino's levels, stars and XP stay
   * exactly where they were. Chips are debited once, and only when the unlock
   * goes through — a casino already open never charges again.
   */
  buyMap(mapId: number): boolean;
  /** The Select Map screen has taken the pending reveal (played or skipped). */
  clearMapReveal(): void;
  licenseForMap(mapId: number): TableLicense;
  /** Upgrade-only license grant. Returns true when the tier actually rose. */
  grantLicense(mapId: number, license: TableLicense): boolean;
  hydrate(data: SaveData['progression']): void;
}

export const useProgressionStore = create<ProgressionState>()((set, get) => ({
  level: INITIAL_PROGRESS.level,
  xpIntoLevel: INITIAL_PROGRESS.xpIntoLevel,
  unlockedMapIds: [1],
  licenses: { 1: 'licensed' },
  pendingRevealMapId: null,

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
    // Map ids are sequential (1…6): casinos open one after another.
    const previous = mapById(mapId - 1);
    return !previous || get().isMapUnlocked(previous.id);
  },

  unlockMap: (mapId) => {
    if (!get().canUnlockMap(mapId)) {
      return false;
    }
    set((state) => ({
      unlockedMapIds: [...state.unlockedMapIds, mapId],
      licenses: { ...state.licenses, [mapId]: 'licensed' },
      pendingRevealMapId: mapId,
    }));
    return true;
  },

  buyMap: (mapId) => {
    const cost = mapUnlockCost(mapId);
    if (cost === null || !get().canUnlockMap(mapId)) {
      return false;
    }
    if (!useEconomyStore.getState().debitChips(cost)) {
      return false;
    }
    set((state) => ({
      unlockedMapIds: [...state.unlockedMapIds, mapId],
      licenses: { ...state.licenses, [mapId]: 'licensed' },
      pendingRevealMapId: mapId,
    }));
    return true;
  },

  clearMapReveal: () => set({ pendingRevealMapId: null }),

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
      pendingRevealMapId: null,
      licenses: Object.fromEntries(
        Object.entries(data.licenses ?? {}).map(([mapId, license]) => [Number(mapId), license]),
      ),
    }),
}));
