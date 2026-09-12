import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema, settingsSchema } from '../../persistence/schema';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Schema v17: the Modern / Classic look becomes a setting. Every existing save
 * opens on Modern (the new default); nothing else in the save moves, and the
 * store only ever takes a known look.
 */

function v16Save(): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  const { uiStyle: _dropped, ...settings } = save.settings as Record<string, unknown>;
  return { ...save, settings };
}

describe('v16 → v17 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[16]).toBeDefined();
  });

  it('adds the Modern look and leaves the rest of the save alone', () => {
    const original = v16Save();
    const parsed = saveDataSchema.parse(runMigrations(original, 16));

    expect(parsed.settings.uiStyle).toBe('modern');
    expect(parsed.settings).toEqual({ ...(original.settings as object), uiStyle: 'modern' });
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.dojo).toEqual(original.dojo);
  });

  it.each(['modern', 'classic'] as const)('accepts %s', (uiStyle) => {
    const settings = createDefaultSave().settings;
    expect(settingsSchema.parse({ ...settings, uiStyle }).uiStyle).toBe(uiStyle);
  });

  it('rejects an unknown look', () => {
    const settings = createDefaultSave().settings;
    expect(() => settingsSchema.parse({ ...settings, uiStyle: 'retro' })).toThrow();
  });
});

describe('settings store: uiStyle', () => {
  beforeEach(() => {
    useSettingsStore.getState().hydrate(createDefaultSave().settings);
  });

  it('defaults to Modern', () => {
    expect(useSettingsStore.getState().uiStyle).toBe('modern');
  });

  it('switches to Classic and back', () => {
    useSettingsStore.getState().setUiStyle('classic');
    expect(useSettingsStore.getState().uiStyle).toBe('classic');
    useSettingsStore.getState().setUiStyle('modern');
    expect(useSettingsStore.getState().uiStyle).toBe('modern');
  });

  it('ignores an unknown look', () => {
    useSettingsStore.getState().setUiStyle('classic');
    useSettingsStore.getState().setUiStyle('retro' as never);
    expect(useSettingsStore.getState().uiStyle).toBe('classic');
  });

  it('falls back to Modern when a save carries an unknown look', () => {
    const settings = createDefaultSave().settings;
    useSettingsStore.getState().hydrate({ ...settings, uiStyle: 'retro' as never });
    expect(useSettingsStore.getState().uiStyle).toBe('modern');
  });
});
