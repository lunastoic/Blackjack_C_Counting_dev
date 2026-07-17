import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultSave } from '../../persistence/defaults';
import { STORAGE_KEYS } from '../../persistence/keys';
import { MigrationError, runMigrations } from '../../persistence/migrations';
import {
  SAVE_SCHEMA_VERSION,
  saveDataSchema,
  saveEnvelopeSchema,
} from '../../persistence/schema';
import { loadSave, resetSave, writeSave } from '../../persistence/storage';

describe('save schema and defaults', () => {
  it('default save passes schema validation', () => {
    expect(() => saveDataSchema.parse(createDefaultSave())).not.toThrow();
  });

  it('default save starts with 500 chips, level 1, map 1 unlocked', () => {
    const save = createDefaultSave();
    expect(save.economy.chips).toBe(500);
    expect(save.progression.level).toBe(1);
    expect(save.progression.xpIntoLevel).toBe(0);
    expect(save.progression.unlockedMapIds).toEqual([1]);
    expect(save.profile.displayName).toBe('Player');
    expect(save.achievements.unlockedIds).toEqual([]);
  });

  it('default settings match the spec defaults', () => {
    const save = createDefaultSave();
    expect(save.settings.dealerSpeed).toBe(1.0);
    expect(save.settings.deckCounts).toEqual({ training: 6, regular: 6, quiz: 6 });
    expect(save.settings.trainingAids.cardUnderglow).toBe(true);
    expect(save.settings.trainingAids.countPulse).toBe(false);
  });

  it('rejects negative chips and out-of-range levels', () => {
    const save = createDefaultSave();
    expect(saveDataSchema.safeParse({
      ...save,
      economy: { ...save.economy, chips: -1 },
    }).success).toBe(false);
    expect(saveDataSchema.safeParse({
      ...save,
      progression: { ...save.progression, level: 26 },
    }).success).toBe(false);
    expect(saveDataSchema.safeParse({
      ...save,
      settings: { ...save.settings, dealerSpeed: 3 },
    }).success).toBe(false);
  });
});

describe('storage round trip', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('writes an envelope and loads identical data back', async () => {
    const save = createDefaultSave();
    save.economy.chips = 12345;
    save.profile.displayName = 'Ace';

    expect(await writeSave(save)).toBe(true);

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.save);
    const envelope = saveEnvelopeSchema.parse(JSON.parse(raw!));
    expect(envelope.version).toBe(SAVE_SCHEMA_VERSION);
    expect(typeof envelope.updatedAt).toBe('string');

    const result = await loadSave();
    expect(result.recoveredFrom).toBeNull();
    expect(result.isFreshInstall).toBe(false);
    expect(result.save).toEqual(save);
  });

  it('reports a fresh install when nothing is stored', async () => {
    const result = await loadSave();
    expect(result.isFreshInstall).toBe(true);
    expect(result.save).toEqual(createDefaultSave());
  });

  it('falls back to defaults on invalid JSON without crashing', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.save, '{not json!!!');
    const result = await loadSave();
    expect(result.recoveredFrom).toContain('not valid JSON');
    expect(result.save).toEqual(createDefaultSave());
  });

  it('falls back to defaults when the envelope is malformed', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.save, JSON.stringify({ chips: 999 }));
    const result = await loadSave();
    expect(result.recoveredFrom).toContain('envelope');
    expect(result.save).toEqual(createDefaultSave());
  });

  it('falls back to defaults when the data fails schema validation', async () => {
    const save = createDefaultSave() as Record<string, unknown>;
    (save.economy as Record<string, unknown>).chips = 'lots';
    await AsyncStorage.setItem(
      STORAGE_KEYS.save,
      JSON.stringify({ version: SAVE_SCHEMA_VERSION, updatedAt: new Date().toISOString(), data: save }),
    );
    const result = await loadSave();
    expect(result.recoveredFrom).toContain('validation');
    expect(result.save).toEqual(createDefaultSave());
  });

  it('falls back to defaults for save versions newer than the app supports', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.save,
      JSON.stringify({ version: 999, updatedAt: new Date().toISOString(), data: {} }),
    );
    const result = await loadSave();
    expect(result.recoveredFrom).toContain('Migration failed');
    expect(result.save).toEqual(createDefaultSave());
  });

  it('reset deletes the stored save', async () => {
    await writeSave(createDefaultSave());
    await resetSave();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.save)).toBeNull();
    const result = await loadSave();
    expect(result.isFreshInstall).toBe(true);
  });
});

describe('migration pipeline', () => {
  it('applies chained migrations in order', () => {
    const migrations = {
      1: (data: unknown) => ({ ...(data as object), a: 1 }),
      2: (data: unknown) => ({ ...(data as object), b: 2 }),
    };
    const migrated = runMigrations({ base: true }, 1, migrations, 3);
    expect(migrated).toEqual({ base: true, a: 1, b: 2 });
  });

  it('is a no-op when already at the current version', () => {
    const data = { untouched: true };
    expect(runMigrations(data, SAVE_SCHEMA_VERSION)).toBe(data);
  });

  it('throws MigrationError when a step is missing', () => {
    expect(() => runMigrations({}, 1, {}, 2)).toThrow(MigrationError);
  });

  it('throws MigrationError for future versions', () => {
    expect(() => runMigrations({}, 99, {}, SAVE_SCHEMA_VERSION)).toThrow(MigrationError);
  });
});
