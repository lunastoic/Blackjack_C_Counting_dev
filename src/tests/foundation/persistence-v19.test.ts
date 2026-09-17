import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema, settingsSchema } from '../../persistence/schema';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Schema v19: the Modern card back becomes a setting. Every existing save
 * starts on D, a save left on the Classic look comes back on Modern (the
 * switch is off the settings screens), nothing else moves, and the store only
 * ever takes a known cover.
 */

function v18Save(uiStyle: 'modern' | 'classic' = 'modern'): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  const { deckCover: _dropped, ...settings } = save.settings as Record<string, unknown>;
  return { ...save, settings: { ...settings, uiStyle } };
}

describe('v18 → v19 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[18]).toBeDefined();
  });

  it('adds cover D and leaves the rest of the save alone', () => {
    const original = v18Save();
    const parsed = saveDataSchema.parse(runMigrations(original, 18));

    expect(parsed.settings.deckCover).toBe('d');
    expect(parsed.settings).toEqual({ ...(original.settings as object), deckCover: 'd' });
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.dojo).toEqual(original.dojo);
  });

  it('brings a Classic save back to Modern', () => {
    const parsed = saveDataSchema.parse(runMigrations(v18Save('classic'), 18));
    expect(parsed.settings.uiStyle).toBe('modern');
  });

  it.each(['d', 'e', 'f'] as const)('accepts cover %s', (deckCover) => {
    const settings = createDefaultSave().settings;
    expect(settingsSchema.parse({ ...settings, deckCover }).deckCover).toBe(deckCover);
  });

  it('rejects an unknown cover', () => {
    const settings = createDefaultSave().settings;
    expect(() => settingsSchema.parse({ ...settings, deckCover: 'g' })).toThrow();
  });
});

describe('settings store: deckCover', () => {
  beforeEach(() => {
    useSettingsStore.getState().hydrate(createDefaultSave().settings);
  });

  it('defaults to D', () => {
    expect(useSettingsStore.getState().deckCover).toBe('d');
  });

  it('switches covers', () => {
    useSettingsStore.getState().setDeckCover('f');
    expect(useSettingsStore.getState().deckCover).toBe('f');
    useSettingsStore.getState().setDeckCover('e');
    expect(useSettingsStore.getState().deckCover).toBe('e');
  });

  it('ignores an unknown cover', () => {
    useSettingsStore.getState().setDeckCover('e');
    useSettingsStore.getState().setDeckCover('g' as never);
    expect(useSettingsStore.getState().deckCover).toBe('e');
  });

  it('falls back to D when a save carries an unknown cover', () => {
    const settings = createDefaultSave().settings;
    useSettingsStore.getState().hydrate({ ...settings, deckCover: 'g' as never });
    expect(useSettingsStore.getState().deckCover).toBe('d');
  });
});
