import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultSave } from '../../persistence/defaults';
import {
  __resetPersistenceForTests,
  applySaveToStores,
  collectSaveFromStores,
  flushSaveNow,
  initializeApp,
} from '../../persistence/hydrate';
import { STORAGE_KEYS } from '../../persistence/keys';
import { SAVE_SCHEMA_VERSION, saveDataSchema } from '../../persistence/schema';
import { loadSave, writeSave } from '../../persistence/storage';
import { useEconomyStore } from '../../stores/economyStore';
import { useHydrationStore } from '../../stores/hydrationStore';
import { useProfileStore } from '../../stores/profileStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';

describe('app hydration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetPersistenceForTests();
    applySaveToStores(createDefaultSave());
  });

  afterEach(() => {
    __resetPersistenceForTests();
  });

  it('hydrates defaults on a fresh install and marks hydration complete', async () => {
    await initializeApp();
    const hydration = useHydrationStore.getState();
    expect(hydration.hasHydrated).toBe(true);
    expect(hydration.isHydrating).toBe(false);
    expect(hydration.hydrationError).toBeNull();
    expect(useEconomyStore.getState().chips).toBe(500);
  });

  it('distributes persisted values to every store', async () => {
    const save = createDefaultSave();
    save.economy.chips = 7777;
    save.profile.displayName = 'Counter';
    save.progression.level = 4;
    save.progression.xpIntoLevel = 12;
    save.settings.dealerSpeed = 1.75;
    await writeSave(save);

    await initializeApp();

    expect(useEconomyStore.getState().chips).toBe(7777);
    expect(useProfileStore.getState().displayName).toBe('Counter');
    expect(useProgressionStore.getState().level).toBe(4);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(12);
    expect(useSettingsStore.getState().dealerSpeed).toBe(1.75);
    expect(useHydrationStore.getState().hydrationError).toBeNull();
  });

  it('records a hydration error and still becomes usable when data is corrupt', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.save, 'corrupted###');
    await initializeApp();
    const hydration = useHydrationStore.getState();
    expect(hydration.hasHydrated).toBe(true);
    expect(hydration.hydrationError).toContain('not valid JSON');
    expect(useEconomyStore.getState().chips).toBe(500); // defaults applied
  });

  it('is idempotent — a second call does not re-run', async () => {
    await initializeApp();
    useEconomyStore.getState().creditChips(100);
    await initializeApp();
    expect(useEconomyStore.getState().chips).toBe(600);
  });

  it('persists store changes after hydration (round trip)', async () => {
    await initializeApp();
    useEconomyStore.getState().creditChips(1500);
    useProfileStore.getState().setDisplayName('HiLo Hero');
    useSettingsStore.getState().setDeckCount('training', 2);
    await flushSaveNow();

    const stored = await loadSave();
    expect(stored.save.economy.chips).toBe(2000);
    expect(stored.save.profile.displayName).toBe('HiLo Hero');
    expect(stored.save.settings.deckCounts.training).toBe(2);
  });

  it('writes a valid versioned envelope on fresh install', async () => {
    await initializeApp();
    // Fresh-install write is fire-and-forget; force a deterministic write.
    await flushSaveNow();
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.save);
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(SAVE_SCHEMA_VERSION);
    expect(saveDataSchema.safeParse(parsed.data).success).toBe(true);
  });

  it('collectSaveFromStores serializes state that passes the schema', async () => {
    await initializeApp();
    useEconomyStore.getState().creditChips(42);
    const collected = collectSaveFromStores();
    expect(saveDataSchema.safeParse(collected).success).toBe(true);
    expect(collected.economy.chips).toBe(542);
  });
});
