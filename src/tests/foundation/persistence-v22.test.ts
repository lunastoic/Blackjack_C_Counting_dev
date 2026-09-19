import { CASINO_MAPS } from '../../engine/betting/casino';
import {
  isShoeRunDrill,
  KIT_TOOL_IDS,
  mapForDrill,
  PREVIEW_DRILL_IDS,
  previewDrillSpec,
  MAP_REWARDS,
  REWARD_LEVEL,
  rewardChips,
  rewardKey,
  rewardState,
} from '../../engine/dojo';
import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema } from '../../persistence/schema';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTrainingStore } from '../../stores/trainingStore';

/** Schema v22: the mystery rewards on the trails and the counter's kit switches. */

function v21Save(): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  const { rewardsOpened: _opened, ...dojo } = save.dojo as Record<string, unknown>;
  const { kitTools: _tools, ...settings } = save.settings as Record<string, unknown>;
  return { ...save, dojo: { ...dojo, flashLevels: { '1:1': 3 } }, settings };
}

describe('v21 → v22 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[21]).toBeDefined();
  });

  it('starts with nothing opened and no kit switches, keeping the ladder', () => {
    const parsed = saveDataSchema.parse(runMigrations(v21Save(), 21));
    expect(parsed.dojo.rewardsOpened).toEqual([]);
    expect(parsed.settings.kitTools).toEqual({});
    expect(parsed.dojo.flashLevels).toEqual({ '1:1': 3 });
  });
});

describe('mystery rewards', () => {
  beforeEach(() => {
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate(defaults.dojo);
    useEconomyStore.getState().hydrate({ ...defaults.economy, chips: 1_000 });
    useSettingsStore.getState().hydrate(defaults.settings);
  });

  it('gives every casino its own tool and preview drill', () => {
    expect(Object.keys(MAP_REWARDS).map(Number)).toEqual(CASINO_MAPS.map((map) => map.id));
    expect(CASINO_MAPS.map((map) => MAP_REWARDS[map.id].tool.id)).toEqual([...KIT_TOOL_IDS]);
    expect(CASINO_MAPS.map((map) => MAP_REWARDS[map.id].drill.id)).toEqual([...PREVIEW_DRILL_IDS]);
    for (const map of CASINO_MAPS) {
      expect(rewardChips(map.id)).toBe(Math.round(map.maxBet / 10));
    }
    expect(REWARD_LEVEL).toEqual({ 1: 1, 2: 3 });
  });

  it('locks a reward until its level is cleared, then opens once', () => {
    const dojo = () => useDojoStore.getState();
    const progress = () => dojo().flashLevels;
    expect(rewardState(progress(), dojo().rewardsOpened, 1, 1)).toBe('locked');
    expect(dojo().openReward(1, 1)).toBeNull();

    dojo().completeTrainingLevel(1, 1, 3);
    expect(rewardState(progress(), dojo().rewardsOpened, 1, 1)).toBe('ready');
    expect(rewardState(progress(), dojo().rewardsOpened, 1, 2)).toBe('locked');

    // The gift hands over a tool, so it pays no chips.
    const chipsBefore = useEconomyStore.getState().chips;
    expect(dojo().openReward(1, 1)).toEqual({ chips: 0 });
    expect(useEconomyStore.getState().chips).toBe(chipsBefore);
    expect(rewardState(progress(), dojo().rewardsOpened, 1, 1)).toBe('opened');
    expect(dojo().openReward(1, 1)).toBeNull();

    // The bag pays a tenth of the casino's table maximum, once.
    dojo().completeTrainingLevel(1, 2, 3);
    dojo().completeTrainingLevel(1, 3, 3);
    const beforeBag = useEconomyStore.getState().chips;
    expect(dojo().openReward(1, 2)).toEqual({ chips: rewardChips(1) });
    expect(useEconomyStore.getState().chips).toBe(beforeBag + rewardChips(1));
    expect(dojo().openReward(1, 2)).toBeNull();
    expect([...dojo().rewardsOpened]).toEqual([rewardKey(1, 1), rewardKey(1, 2)]);
  });

  it('keeps kit switches per tool', () => {
    const settings = () => useSettingsStore.getState();
    expect(settings().kitTools).toEqual({});
    settings().setKitTool('pocketCard', false);
    expect(settings().kitTools.pocketCard).toBe(false);
    settings().setKitTool('pocketCard', true);
    expect(settings().kitTools.pocketCard).toBe(true);
  });
});

describe('preview drills', () => {
  it('every money bag carries a drill with a spec, and only Casino Night is a shoe', () => {
    for (const id of PREVIEW_DRILL_IDS) {
      const spec = previewDrillSpec(id);
      expect(spec.title.length).toBeGreaterThan(0);
      expect(spec.brief.length).toBeGreaterThan(0);
      expect(spec.level).toBe(0);
      expect(isShoeRunDrill(id)).toBe(id === 'casinoNight');
      expect(MAP_REWARDS[mapForDrill(id)].drill.id).toBe(id);
    }
  });

  it('a preview drill banks no stars, chips or bests', () => {
    const dojo = () => useDojoStore.getState();
    const chipsBefore = useEconomyStore.getState().chips;
    const store = useTrainingStore.getState();
    store.loadPractice(previewDrillSpec('divideIt'));
    expect(useTrainingStore.getState().practice).toBe(true);
    store.begin();
    for (let n = 0; n < 12; n += 1) {
      const item = useTrainingStore.getState().item;
      if (!item || useTrainingStore.getState().status !== 'asking') {
        break;
      }
      useTrainingStore.getState().answer(item.kind === 'cards' ? item.correct : item.item.correct);
    }
    expect(useTrainingStore.getState().stars).toBeGreaterThan(0);
    expect(dojo().flashLevels).toEqual({});
    expect(dojo().flashBests).toEqual({});
    expect(useEconomyStore.getState().chips).toBe(chipsBefore);
    useTrainingStore.getState().reset();
  });
});
