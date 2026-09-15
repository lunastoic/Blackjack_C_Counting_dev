import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema } from '../../persistence/schema';
import { useProgressionStore } from '../../stores/progressionStore';

/**
 * Schema v18: a casino's table opens with the casino. Every casino a save had
 * already unlocked gets the full license so nobody loses a table they could
 * reach; everything else in the save stays as it was.
 */

function v17Save(progression: Record<string, unknown>): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  return { ...save, progression: { ...(save.progression as object), ...progression } };
}

describe('v17 → v18 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[17]).toBeDefined();
  });

  it('licenses every unlocked casino and keeps the rest of the save', () => {
    const original = v17Save({ unlockedMapIds: [1, 2, 3], licenses: { '1': 'licensed' } });
    const parsed = saveDataSchema.parse(runMigrations(original, 17));

    expect(parsed.progression.licenses).toEqual({
      '1': 'licensed',
      '2': 'licensed',
      '3': 'licensed',
    });
    expect(parsed.progression.unlockedMapIds).toEqual([1, 2, 3]);
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.settings).toEqual(original.settings);
    expect(parsed.dojo).toEqual(original.dojo);
  });

  it('opens the first table on a fresh-ladder save', () => {
    const parsed = saveDataSchema.parse(runMigrations(v17Save({ licenses: {} }), 17));
    expect(parsed.progression.licenses).toEqual({ '1': 'licensed' });
  });

  it('never downgrades a license the player already earned', () => {
    const parsed = saveDataSchema.parse(
      runMigrations(v17Save({ unlockedMapIds: [1], licenses: { '1': 'licensed', '2': 'permit' } }), 17),
    );
    expect(parsed.progression.licenses).toEqual({ '1': 'licensed', '2': 'permit' });
  });

  it('a fresh save opens Luna Luxe and its table', () => {
    const save = createDefaultSave();
    expect(save.progression.licenses).toEqual({ '1': 'licensed' });
    useProgressionStore.getState().hydrate(save.progression);
    expect(useProgressionStore.getState().licenseForMap(1)).toBe('licensed');
    expect(useProgressionStore.getState().isMapUnlocked(2)).toBe(false);
  });
});
