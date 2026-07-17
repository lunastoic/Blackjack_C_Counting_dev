import { useAchievementStore } from '../stores/achievementStore';
import { useEconomyStore } from '../stores/economyStore';
import { useHydrationStore } from '../stores/hydrationStore';
import { useModeStatsStore } from '../stores/modeStatsStore';
import { useProfileStore } from '../stores/profileStore';
import { useProgressionStore } from '../stores/progressionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createDefaultSave } from './defaults';
import { SaveData } from './schema';
import { loadSave, resetSave, writeSave } from './storage';

/**
 * Bootstrap: load → validate/migrate → hydrate stores → subscribe for writes.
 * Saves are debounced (one write per burst of changes), never per-render.
 * Only stable progress is persisted; transient state (toast queues, hydration
 * flags, future round state) stays in memory.
 */

const SAVE_DEBOUNCE_MS = 400;

let initialized = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const unsubscribers: (() => void)[] = [];

export function applySaveToStores(save: SaveData): void {
  useProfileStore.getState().hydrate(save.profile);
  useEconomyStore.getState().hydrate(save.economy);
  useProgressionStore.getState().hydrate(save.progression);
  useSettingsStore.getState().hydrate(save.settings);
  useAchievementStore.getState().hydrate(save.achievements, save.mapAchievements);
  useModeStatsStore.getState().hydrate(save.modeStats);
}

export function collectSaveFromStores(): SaveData {
  const profile = useProfileStore.getState();
  const economy = useEconomyStore.getState();
  const progression = useProgressionStore.getState();
  const settings = useSettingsStore.getState();

  return {
    profile: {
      displayName: profile.displayName,
      createdAt: profile.createdAt,
    },
    economy: {
      chips: economy.chips,
      lastBet: economy.lastBet,
      dailyRewardClaimedAt: economy.dailyRewardClaimedAt,
      adRewardClaimedAt: economy.adRewardClaimedAt,
    },
    progression: {
      level: progression.level,
      xpIntoLevel: progression.xpIntoLevel,
      unlockedMapIds: [...progression.unlockedMapIds],
    },
    settings: {
      soundEnabled: settings.soundEnabled,
      hapticsEnabled: settings.hapticsEnabled,
      dealerSpeed: settings.dealerSpeed,
      deckCounts: { ...settings.deckCounts },
      trainingAids: { ...settings.trainingAids },
      reducedMotion: settings.reducedMotion,
    },
    achievements: {
      stats: { ...useAchievementStore.getState().stats },
      unlockedIds: [],
    },
    mapAchievements: Object.fromEntries(
      Object.entries(useAchievementStore.getState().mapSlices).map(([mapId, slice]) => [
        mapId,
        { stats: { ...slice.stats }, unlockedIds: [...slice.unlockedIds] },
      ]),
    ),
    modeStats: {
      regular: { ...useModeStatsStore.getState().regular },
      quiz: { ...useModeStatsStore.getState().quiz },
    },
  };
}

function scheduleSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeSave(collectSaveFromStores());
  }, SAVE_DEBOUNCE_MS);
}

/** Writes immediately (used by tests and the dev reset flow). */
export async function flushSaveNow(): Promise<boolean> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  return writeSave(collectSaveFromStores());
}

function subscribeForPersistence(): void {
  // The hydration store is deliberately NOT subscribed — it is transient.
  const stores = [
    useProfileStore,
    useEconomyStore,
    useProgressionStore,
    useSettingsStore,
    useAchievementStore,
    useModeStatsStore,
  ] as const;
  for (const store of stores) {
    unsubscribers.push(store.subscribe(scheduleSave));
  }
}

/**
 * App bootstrap. Idempotent: repeat calls are no-ops so fast-refresh and
 * remounts cannot double-subscribe.
 */
export async function initializeApp(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  const hydration = useHydrationStore.getState();
  hydration.markHydrating();

  const result = await loadSave();
  applySaveToStores(result.save);
  subscribeForPersistence();

  if (result.isFreshInstall) {
    void writeSave(result.save);
  }

  useHydrationStore.getState().markHydrated(result.recoveredFrom);
}

/**
 * DEV-ONLY: wipe storage and restore in-memory defaults. Guarded by __DEV__ at
 * every call site.
 */
export async function devResetSave(): Promise<void> {
  await resetSave();
  applySaveToStores(createDefaultSave());
  await flushSaveNow();
}

/** Test-only teardown so suites can re-run initializeApp with fresh state. */
export function __resetPersistenceForTests(): void {
  initialized = false;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  while (unsubscribers.length > 0) {
    unsubscribers.pop()?.();
  }
  useHydrationStore.getState().reset();
}
