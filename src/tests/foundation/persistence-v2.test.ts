import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultSave } from '../../persistence/defaults';
import { collectSaveFromStores } from '../../persistence/hydrate';
import { STORAGE_KEYS } from '../../persistence/keys';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { SAVE_SCHEMA_VERSION, saveDataSchema } from '../../persistence/schema';
import { loadSave } from '../../persistence/storage';
import { useModeStatsStore } from '../../stores/modeStatsStore';

/**
 * Schema v2: per-mode statistics. Existing v1 saves must upgrade losslessly
 * with zeroed mode stats; fresh saves and round-trips must validate.
 */

const ZERO_MODE_STATS = {
  regular: { handsPlayed: 0, wins: 0, pushes: 0, losses: 0, blackjacks: 0, netChips: 0 },
  quiz: {
    questionsAnswered: 0,
    questionsCorrect: 0,
    bestStreak: 0,
    cyclesCompleted: 0,
    chipsEarned: 0,
  },
};

/** A realistic v1 payload: today's defaults minus the v2 field. */
function v1Save(): Record<string, unknown> {
  const { modeStats: _dropped, ...v1 } = createDefaultSave();
  return v1;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useModeStatsStore.getState().hydrate(createDefaultSave().modeStats);
});

/** A realistic v2 payload: today's defaults minus the v3 field. */
function v2Save(): Record<string, unknown> {
  const { mapAchievements: _dropped, ...v2 } = createDefaultSave();
  return v2;
}

describe('v2 → v3 migration', () => {
  it('adds per-casino achievement slices while preserving v2 fields', () => {
    const original = v2Save();
    const migrated = runMigrations(original, 2);
    const parsed = saveDataSchema.parse(migrated);

    expect(Object.keys(parsed.mapAchievements)).toHaveLength(6);
    expect(parsed.mapAchievements['1'].unlockedIds).toEqual([]);
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.modeStats).toEqual(original.modeStats);
  });
});

describe('v1 → v2 migration', () => {
  it('is registered and the current version is 3', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(3);
    expect(MIGRATIONS[1]).toBeDefined();
    expect(MIGRATIONS[2]).toBeDefined();
  });

  it('adds zeroed mode stats while preserving every v1 field', () => {
    const original = v1Save();
    const migrated = runMigrations(original, 1);
    const parsed = saveDataSchema.parse(migrated);

    expect(parsed.modeStats).toEqual(ZERO_MODE_STATS);
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.settings).toEqual(original.settings);
    expect(parsed.achievements).toEqual(original.achievements);
  });

  it('loads a stored v1 envelope end-to-end without falling back to defaults', async () => {
    const stored = {
      version: 1,
      updatedAt: new Date().toISOString(),
      data: { ...v1Save(), economy: { ...createDefaultSave().economy, chips: 4321 } },
    };
    await AsyncStorage.setItem(STORAGE_KEYS.save, JSON.stringify(stored));

    const result = await loadSave();
    expect(result.recoveredFrom).toBeNull();
    expect(result.save.economy.chips).toBe(4321); // player progress preserved
    expect(result.save.modeStats).toEqual(ZERO_MODE_STATS);
  });
});

describe('mode stats persistence round-trip', () => {
  it('collects live store values into the save payload', () => {
    const store = useModeStatsStore.getState();
    store.recordRegularHand('win', 150);
    store.recordRegularHand('loss', -50);
    store.recordQuizAnswer(true, 1);
    store.recordQuizCycleReward(250);

    const save = collectSaveFromStores();
    expect(save.modeStats.regular).toEqual({
      handsPlayed: 2,
      wins: 1,
      pushes: 0,
      losses: 1,
      blackjacks: 0,
      netChips: 100,
    });
    expect(save.modeStats.quiz).toEqual({
      questionsAnswered: 1,
      questionsCorrect: 1,
      bestStreak: 1,
      cyclesCompleted: 1,
      chipsEarned: 250,
    });
    // The whole payload must still validate against the schema.
    expect(() => saveDataSchema.parse(save)).not.toThrow();
  });

  it('hydrates persisted values back into the store', () => {
    const defaults = createDefaultSave();
    useModeStatsStore.getState().hydrate({
      ...defaults.modeStats,
      quiz: { ...defaults.modeStats.quiz, bestStreak: 7, questionsAnswered: 40 },
    });
    expect(useModeStatsStore.getState().quiz.bestStreak).toBe(7);
    expect(useModeStatsStore.getState().quiz.questionsAnswered).toBe(40);
  });
});
