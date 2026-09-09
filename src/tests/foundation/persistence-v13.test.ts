import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema } from '../../persistence/schema';

/**
 * Schema v13: training levels earn their stars in stages and two stars clear
 * a level. A level cleared under the old scoring with one star stays
 * cleared (it becomes two); higher stars are untouched.
 */

function v12Save(flashLevels: Record<string, unknown>): Record<string, unknown> {
  const save = createDefaultSave();
  return { ...save, dojo: { ...save.dojo, flashLevels } };
}

describe('v12 → v13 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[12]).toBeDefined();
  });

  it('lifts one-star clears to two and keeps the rest', () => {
    const original = v12Save({ '1:1': 1, '1:2': 2, '1:3': 3, '2:1': 1 });
    const parsed = saveDataSchema.parse(runMigrations(original, 12));

    expect(parsed.dojo.flashLevels).toEqual({ '1:1': 2, '1:2': 2, '1:3': 3, '2:1': 2 });
    expect(parsed.dojo.flashCountTipSeen).toBe(false);
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.settings).toEqual(original.settings);
  });

  it('leaves an empty ladder empty', () => {
    const parsed = saveDataSchema.parse(runMigrations(v12Save({}), 12));
    expect(parsed.dojo.flashLevels).toEqual({});
  });
});
