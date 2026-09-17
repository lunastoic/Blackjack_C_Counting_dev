import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema } from '../../persistence/schema';
import { useDojoStore } from '../../stores/dojoStore';

/** Schema v20: training levels keep personal bests; every save starts with none. */

function v19Save(): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  const { flashBests: _dropped, ...dojo } = save.dojo as Record<string, unknown>;
  return { ...save, dojo: { ...dojo, flashLevels: { '1:1': 3 }, flashPace: { '1:1': 40 } } };
}

describe('v19 → v20 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[19]).toBeDefined();
  });

  it('adds empty bests and keeps the ladder', () => {
    const original = v19Save();
    const parsed = saveDataSchema.parse(runMigrations(original, 19));
    expect(parsed.dojo.flashBests).toEqual({});
    expect(parsed.dojo.flashLevels).toEqual({ '1:1': 3 });
    expect(parsed.dojo.flashPace).toEqual({ '1:1': 40 });
    expect(parsed.economy).toEqual(original.economy);
  });
});

describe('training bests', () => {
  beforeEach(() => {
    useDojoStore.getState().hydrate(createDefaultSave().dojo);
  });

  it('sets a first best without calling it beaten, then only goes up', () => {
    const dojo = () => useDojoStore.getState();
    expect(dojo().recordTrainingBest(1, 1, 20, 6)).toEqual({ runIsBest: false, comboIsBest: false });
    expect(dojo().flashBests['1:1']).toEqual({ run: 20, combo: 6 });
    expect(dojo().recordTrainingBest(1, 1, 25, 4)).toEqual({ runIsBest: true, comboIsBest: false });
    expect(dojo().flashBests['1:1']).toEqual({ run: 25, combo: 6 });
    expect(dojo().recordTrainingBest(1, 1, 10, 9)).toEqual({ runIsBest: false, comboIsBest: true });
    expect(dojo().flashBests['1:1']).toEqual({ run: 25, combo: 9 });
  });
});
