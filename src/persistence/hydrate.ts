import { useAchievementStore } from '../stores/achievementStore';
import { useCampaignStore } from '../stores/campaignStore';
import { useDailyGoalStore } from '../stores/dailyGoalStore';
import { useDojoStore } from '../stores/dojoStore';
import { useEconomyStore } from '../stores/economyStore';
import { useHydrationStore } from '../stores/hydrationStore';
import { useModeStatsStore } from '../stores/modeStatsStore';
import { useProfileStore } from '../stores/profileStore';
import { useProgressionStore } from '../stores/progressionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWeakSpotsStore } from '../stores/weakSpotsStore';
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
  useCampaignStore.getState().hydrate(save.campaign);
  useDojoStore.getState().hydrate(save.dojo);
  useWeakSpotsStore.getState().hydrate(save.weakSpots);
  useDailyGoalStore.getState().hydrate(save.daily);
}

export function collectSaveFromStores(): SaveData {
  const profile = useProfileStore.getState();
  const economy = useEconomyStore.getState();
  const progression = useProgressionStore.getState();
  const settings = useSettingsStore.getState();
  const dojo = useDojoStore.getState();
  const daily = useDailyGoalStore.getState();

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
      licenses: Object.fromEntries(
        Object.entries(progression.licenses).flatMap(([mapId, license]) =>
          license === 'permit' || license === 'licensed' ? [[String(mapId), license]] : [],
        ),
      ),
    },
    settings: {
      soundEnabled: settings.soundEnabled,
      hapticsEnabled: settings.hapticsEnabled,
      cardDeck: settings.cardDeck,
      dealerSpeed: settings.dealerSpeed,
      deckCounts: { ...settings.deckCounts },
      trainingAids: { ...settings.trainingAids },
      countCoachLevel: settings.countCoachLevel,
      trainingMode: settings.trainingMode,
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
      learn: { ...useModeStatsStore.getState().learn },
    },
    campaign: {
      lessonsDone: [...useCampaignStore.getState().lessonsDone],
      nightsDone: [...useCampaignStore.getState().nightsDone],
    },
    dojo: {
      completedLessons: [...dojo.completedLessons],
      totalDojoXp: dojo.totalDojoXp,
      drillBests: { ...dojo.drillBests },
      dailyStreak: dojo.dailyStreak,
      lastPracticeAt: dojo.lastPracticeAt,
      tableObjectivesCompleted: [...dojo.tableObjectivesCompleted],
      onboardingDone: dojo.onboardingDone,
      flashLevels: { ...dojo.flashLevels },
      flashCountTipSeen: dojo.flashCountTipSeen,
      flashPace: { ...dojo.flashPace },
    },
    weakSpots: {
      spots: useWeakSpotsStore.getState().spots.map((spot) => ({
        ...spot,
        cards: spot.cards.map((card) => ({ ...card })),
      })),
    },
    daily: {
      dayKey: daily.dayKey,
      progress: daily.progress,
      streak: daily.streak,
      lastClaimedDayKey: daily.lastClaimedDayKey,
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
    useCampaignStore,
    useDojoStore,
    useWeakSpotsStore,
    useDailyGoalStore,
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
