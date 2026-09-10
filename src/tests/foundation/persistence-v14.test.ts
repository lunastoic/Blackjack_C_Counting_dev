import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema } from '../../persistence/schema';

/**
 * Schema v14: best pace per training level (`dojo.flashPace`), the weak-spot
 * log (`weakSpots`) and the daily goal (`daily`). A v13 save gains all three
 * empty; nothing else moves.
 */

function v13Save(): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  const { weakSpots: _weakSpots, daily: _daily, ...rest } = save;
  const { flashPace: _flashPace, ...dojo } = rest.dojo as Record<string, unknown>;
  return { ...rest, dojo };
}

describe('v13 → v14 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[13]).toBeDefined();
  });

  it('adds empty pace, weak-spot and daily-goal records and keeps the rest', () => {
    const original = v13Save();
    expect(original.weakSpots).toBeUndefined();
    expect((original.dojo as Record<string, unknown>).flashPace).toBeUndefined();

    const parsed = saveDataSchema.parse(runMigrations(original, 13));

    expect(parsed.dojo.flashPace).toEqual({});
    expect(parsed.weakSpots).toEqual({ spots: [] });
    expect(parsed.daily).toEqual({ dayKey: '', progress: 0, streak: 0, lastClaimedDayKey: null });
    expect(parsed.dojo.flashLevels).toEqual((original.dojo as Record<string, unknown>).flashLevels);
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.settings).toEqual(original.settings);
  });

  it('a current save round-trips through the schema', () => {
    expect(() => saveDataSchema.parse(createDefaultSave())).not.toThrow();
  });
});
