import { create } from 'zustand';
import { CASINO_MAPS, STARTING_BANKROLL } from '../engine/betting/casino';
import { INITIAL_PROGRESS, MAX_LEVEL } from '../engine/progression/progression';
import { useDojoStore } from './dojoStore';
import { useEconomyStore } from './economyStore';
import { useProgressionStore } from './progressionStore';

/**
 * Testing aids for the count training ladder. Nothing here is persisted and
 * every entry point is gated on FLASH_DEBUG_AVAILABLE, so the whole kit falls
 * away once that is back to __DEV__.
 */
/**
 * Flip to true only for a phone build that needs the table before the ladder
 * is played through; store builds ship with it false (→ dev only).
 */
const TESTING_TOOLS_IN_RELEASE = false;
export const FLASH_DEBUG_AVAILABLE = __DEV__ || TESTING_TOOLS_IN_RELEASE;

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

export const DEBUG_CHIP_GRANT = 1_000;

/** Drops a stack on the bankroll, saved like a real credit. */
export function debugAddChips(amount = DEBUG_CHIP_GRANT): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  useEconomyStore.getState().creditChips(amount);
}

/** Back to the fresh-install bankroll. */
export function debugResetChips(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  useEconomyStore.setState({ chips: STARTING_BANKROLL });
}

/** One player level up (XP into the level cleared), capped at the max. */
export function debugAddPlayerLevel(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  const { level } = useProgressionStore.getState();
  useProgressionStore.setState({ level: Math.min(MAX_LEVEL, level + 1), xpIntoLevel: 0 });
}

/** Player level and XP back to a fresh install; maps and licenses stay. */
export function debugResetPlayerLevel(): void {
  if (!FLASH_DEBUG_AVAILABLE) {
    return;
  }
  useProgressionStore.setState({ level: INITIAL_PROGRESS.level, xpIntoLevel: INITIAL_PROGRESS.xpIntoLevel });
}
