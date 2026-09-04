import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema, settingsSchema } from '../../persistence/schema';

/**
 * Schema v12: the table-side Training Mode switch. Existing v11 saves upgrade
 * with the switch on — players keep the aids they already had on screen.
 */

function v11Save(): Record<string, unknown> {
  const save = createDefaultSave();
  const { trainingMode: _dropped, ...settings } = save.settings;
  return { ...save, settings };
}

describe('v11 → v12 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[11]).toBeDefined();
  });

  it('turns Training Mode on while preserving every v11 setting', () => {
    const original = v11Save();
    const originalSettings = original.settings as Record<string, unknown>;
    originalSettings.countCoachLevel = 'learn';
    originalSettings.trainingAids = {
      ...(originalSettings.trainingAids as Record<string, unknown>),
      cardUnderglow: false,
    };

    const parsed = saveDataSchema.parse(runMigrations(original, 11));

    expect(parsed.settings.trainingMode).toBe(true);
    expect(parsed.settings.countCoachLevel).toBe('learn');
    expect(parsed.settings.trainingAids.cardUnderglow).toBe(false);
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.dojo).toEqual(original.dojo);
  });

  it('v11 settings no longer validate without the switch', () => {
    expect(() => settingsSchema.parse((v11Save() as { settings: unknown }).settings)).toThrow();
  });

  it('fresh saves default the switch on', () => {
    const parsed = saveDataSchema.parse(createDefaultSave());
    expect(parsed.settings.trainingMode).toBe(true);
  });
});
