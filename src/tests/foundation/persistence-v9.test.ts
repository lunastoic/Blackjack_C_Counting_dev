import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { SAVE_SCHEMA_VERSION, saveDataSchema } from '../../persistence/schema';

/**
 * Schema v9: Count Flash ladder progress in the dojo slice. Existing v8 saves
 * upgrade with an empty ladder — unless a casino was already licensed, in
 * which case every level counts as cleared so the table stays open.
 */

function v8Save(): Record<string, unknown> {
  const save = createDefaultSave();
  const { flashLevels: _dropped, flashCountTipSeen: _dropped2, ...dojo } = save.dojo;
  return { ...save, dojo };
}

describe('v8 → v9 migration', () => {
  it('is registered and the current version is 12', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(12);
    expect(MIGRATIONS[8]).toBeDefined();
    expect(MIGRATIONS[9]).toBeDefined();
    expect(MIGRATIONS[10]).toBeDefined();
    expect(MIGRATIONS[11]).toBeDefined();
  });

  it('adds an empty flash ladder while preserving every v8 field', () => {
    const original = v8Save();
    const migrated = runMigrations(original, 8);
    const parsed = saveDataSchema.parse(migrated);

    expect(parsed.dojo.flashLevels).toEqual({});
    expect(parsed.dojo.flashCountTipSeen).toBe(false);
    expect(parsed.dojo.onboardingDone).toBe(false);
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
  });

  it('grandfathers licensed casinos as fully cleared ladders', () => {
    const original = v8Save();
    original.progression = {
      ...(original.progression as Record<string, unknown>),
      unlockedMapIds: [1, 2],
      licenses: { '1': 'licensed', '2': 'permit' },
    };
    const parsed = saveDataSchema.parse(runMigrations(original, 8));

    expect(Object.keys(parsed.dojo.flashLevels)).toHaveLength(6);
    for (let level = 1; level <= 6; level++) {
      expect(parsed.dojo.flashLevels[`1:${level}`]).toBe(3);
    }
    expect(parsed.dojo.flashLevels['2:1']).toBeUndefined();
  });

  it('fresh saves validate with an empty ladder', () => {
    const parsed = saveDataSchema.parse(createDefaultSave());
    expect(parsed.dojo.flashLevels).toEqual({});
  });

  it('rejects star counts outside 1–3', () => {
    const save = createDefaultSave();
    expect(() =>
      saveDataSchema.parse({ ...save, dojo: { ...save.dojo, flashLevels: { '1:1': 0 } } }),
    ).toThrow();
    expect(() =>
      saveDataSchema.parse({ ...save, dojo: { ...save.dojo, flashLevels: { '1:1': 4 } } }),
    ).toThrow();
  });
});

/**
 * Schema v11: the placeholder Count Flash levels became the count training
 * ladder. Saved level clears keep their place; orphaned or malformed entries
 * are dropped so unlocking stays one level at a time.
 */
function v10Save(flashLevels: Record<string, unknown>): Record<string, unknown> {
  const save = createDefaultSave();
  return { ...save, dojo: { ...save.dojo, flashLevels } };
}

describe('v10 → v11 migration', () => {
  it('keeps a partly cleared ladder exactly where it was', () => {
    const parsed = saveDataSchema.parse(runMigrations(v10Save({ '1:1': 3, '1:2': 2 }), 10));
    expect(parsed.dojo.flashLevels).toEqual({ '1:1': 3, '1:2': 2 });
  });

  it('keeps a fully cleared casino cleared (the table stays open)', () => {
    const cleared: Record<string, number> = {};
    for (let level = 1; level <= 6; level++) {
      cleared[`1:${level}`] = 3;
    }
    const parsed = saveDataSchema.parse(runMigrations(v10Save({ ...cleared, '2:1': 1 }), 10));
    expect(parsed.dojo.flashLevels).toEqual({ ...cleared, '2:1': 1 });
  });

  it('drops entries not reachable from level 1 and clamps stars', () => {
    const parsed = saveDataSchema.parse(
      runMigrations(v10Save({ '1:1': 5, '1:3': 3, '2:2': 3, 'junk': 3, '3:1': 0 }), 10),
    );
    expect(parsed.dojo.flashLevels).toEqual({ '1:1': 3 });
  });

  it('runs the full ladder from v8', () => {
    const parsed = saveDataSchema.parse(runMigrations(v8Save(), 8));
    expect(parsed.dojo.flashLevels).toEqual({});
    expect(parsed.dojo.flashCountTipSeen).toBe(false);
  });
});
