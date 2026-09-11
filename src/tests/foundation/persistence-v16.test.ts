import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema, settingsSchema } from '../../persistence/schema';

/**
 * Schema v16: Learn folds into Full. The dial is Off / Full, and a save that
 * was on Learn carries on under Full (which opens with the same fogged
 * meter). Off and Full saves are untouched; the value itself still parses.
 */

function v15Save(countCoachLevel: string): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  return { ...save, settings: { ...(save.settings as object), countCoachLevel } };
}

describe('v15 → v16 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[15]).toBeDefined();
  });

  it('moves Learn onto Full and leaves the rest of the save alone', () => {
    const original = v15Save('learn');
    const parsed = saveDataSchema.parse(runMigrations(original, 15));

    expect(parsed.settings.countCoachLevel).toBe('full');
    expect(parsed.settings).toEqual({ ...(original.settings as object), countCoachLevel: 'full' });
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.dojo).toEqual(original.dojo);
  });

  it.each(['off', 'full'] as const)('keeps %s where it is', (level) => {
    const parsed = saveDataSchema.parse(runMigrations(v15Save(level), 15));
    expect(parsed.settings.countCoachLevel).toBe(level);
  });

  it('still parses a Learn value, so an unmigrated save never falls to defaults', () => {
    const settings = createDefaultSave().settings;
    expect(() => settingsSchema.parse({ ...settings, countCoachLevel: 'learn' })).not.toThrow();
  });
});
