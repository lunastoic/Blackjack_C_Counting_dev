import { create } from 'zustand';
import { CASINO_MAPS } from '../engine/betting/casino';
import { useDojoStore } from './dojoStore';
import { useProgressionStore } from './progressionStore';

/**
 * DEV-ONLY testing aids for the count training ladder. Nothing here is persisted
 * and every entry point is gated on FLASH_DEBUG_AVAILABLE (__DEV__), so the
 * whole kit falls away in production builds. Remove before release.
 */
export const FLASH_DEBUG_AVAILABLE = __DEV__;

interface FlashDebugState {
  /** Treat every level and every casino as unlocked (nothing is marked done). */
  readonly unlockAll: boolean;
  /**
   * Play the Hi-Lo primer (then the level's own slides) on every level start,
   * not just map 1 level 1 — cleared levels included.
   */
  readonly tutorialEveryLevel: boolean;
  readonly setUnlockAll: (value: boolean) => void;
  readonly setTutorialEveryLevel: (value: boolean) => void;
}

export const useFlashDebugStore = create<FlashDebugState>()((set) => ({
  unlockAll: false,
  // Off by default so dev sees the shipped flow; flip it in Settings to
  // eyeball the primer on any level.
  tutorialEveryLevel: false,
  setUnlockAll: (value) => set({ unlockAll: FLASH_DEBUG_AVAILABLE && value }),
  setTutorialEveryLevel: (value) => set({ tutorialEveryLevel: FLASH_DEBUG_AVAILABLE && value }),
}));

/** Marks the map's next level cleared with a perfect run (3 stars). */
export function debugCompleteNextLevel(mapId: number): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  const dojo = useDojoStore.getState();
  const next = dojo.nextFlashLevel(mapId);
  if (next !== null) {
    dojo.completeTrainingLevel(mapId, next, 3);
  }
}

/** Clears the whole map's ladder in one tap (licenses the table, opens the next casino). */
export function debugCompleteMap(mapId: number): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  const dojo = useDojoStore.getState();
  let next = dojo.nextFlashLevel(mapId);
  while (next !== null) {
    dojo.completeTrainingLevel(mapId, next, 3);
    next = useDojoStore.getState().nextFlashLevel(mapId);
  }
}

/** Clears every casino's ladder (each table licensed, every casino open). */
export function debugCompleteAllMaps(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  for (const map of CASINO_MAPS) {
    debugCompleteMap(map.id);
  }
}

/** Wipes level progress and the licenses it earned; map unlocks stay. */
export function debugResetLevels(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  useDojoStore.setState({ flashLevels: {} });
  useProgressionStore.setState({ licenses: {} });
}

/** Opens every casino, saved like a real unlock (bypasses the licence gate). */
export function debugUnlockAllMaps(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  useProgressionStore.setState({ unlockedMapIds: CASINO_MAPS.map((map) => map.id) });
}

/** Locks every casino but the first; level progress stays. */
export function debugResetMaps(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  useProgressionStore.setState({ unlockedMapIds: [1] });
}

/** Wipes level progress, licenses, and map unlocks back to a fresh ladder. */
export function debugResetLevelsAndMaps(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  useDojoStore.setState({ flashLevels: {} });
  useProgressionStore.setState({ unlockedMapIds: [1], licenses: {} });
}
