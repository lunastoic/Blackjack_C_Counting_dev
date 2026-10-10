import { evaluateCards } from '../../engine/hand/evaluate';
import { TOP_INDEX_PLAY_IDS } from '../../engine/strategy/indexPlays';
import {
  flashLevelKey,
  FLIP_MAX,
  FLIP_MIN,
  flipPointPool,
  isFlipStopRight,
  makeFlipPointItem,
  sliderFraction,
  sweepValueAt,
  trainingLevelSpec,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { __setFlipPointRngForTests, FLIP_REVEAL_MS, useFlipPointStore } from '../../stores/flipPointStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';

describe('flip point — engine', () => {
  it('draws only plays whose index sits on the slider; top keeps to the top six', () => {
    for (const play of flipPointPool('all')) {
      expect(play.index).toBeGreaterThanOrEqual(FLIP_MIN);
      expect(play.index).toBeLessThanOrEqual(FLIP_MAX);
    }
    const top = flipPointPool('top');
    expect(top.length).toBeGreaterThan(0);
    for (const play of top) {
      expect(TOP_INDEX_PLAY_IDS).toContain(play.id);
    }
  });

  it('deals the hand the play is about, against its upcard, never the same spot twice running', () => {
    let previous: string | undefined;
    for (let seed = 1; seed <= 80; seed++) {
      const item = makeFlipPointItem('all', seededRng(seed), previous);
      expect(item.play.id).not.toBe(previous);
      const { total, isSoft } = evaluateCards(item.playerCards);
      if (item.play.hand === 'pair10') {
        expect(total).toBe(20);
      } else {
        expect(total).toBe(item.play.hand);
        expect(isSoft).toBe(false);
      }
      const upWorth = item.dealerUp.rank === 'A' ? 11 : ['10', 'J', 'Q', 'K'].includes(item.dealerUp.rank) ? 10 : Number(item.dealerUp.rank);
      expect(upWorth).toBe(item.play.up);
      previous = item.play.id;
    }
  });

  it('sweeps linearly from −5 to +5 and judges a stop by the tolerance', () => {
    expect(sweepValueAt(0, 6000)).toBe(-5);
    expect(sweepValueAt(3000, 6000)).toBe(0);
    expect(sweepValueAt(9000, 6000)).toBe(5);
    expect(sliderFraction(0)).toBe(0.5);
    expect(isFlipStopRight(0.4, 0, 0.5)).toBe(true);
    expect(isFlipStopRight(-0.5, 0, 0.5)).toBe(true);
    expect(isFlipStopRight(0.6, 0, 0.5)).toBe(false);
  });
});

describe('flip point — the level', () => {
  const store = () => useFlipPointStore.getState();

  /** Wait until the knob sits at `value`, then stop it. */
  function stopAt(value: number): boolean {
    const spec = store().spec!;
    const elapsed = Date.now() - store().sweepStartedAt!;
    const target = ((value - FLIP_MIN) / (FLIP_MAX - FLIP_MIN)) * spec.sweepMs;
    jest.advanceTimersByTime(Math.max(0, Math.round(target - elapsed)));
    return store().stop();
  }

  function rightStop(): void {
    expect(store().status).toBe('sweeping');
    // A flip at +5 sits at the very end of the sweep: stop just before it runs out.
    const index = store().item!.play.index;
    expect(stopAt(index >= FLIP_MAX ? index - 0.2 : index)).toBe(true);
    jest.advanceTimersByTime(FLIP_REVEAL_MS);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    __resetPersistenceForTests();
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate(defaults.dojo);
    useEconomyStore.getState().hydrate(defaults.economy);
    useProgressionStore.getState().hydrate(defaults.progression);
    useSettingsStore.getState().hydrate(defaults.settings);
    __setFlipPointRngForTests(seededRng(9));
    store().load(5, 2);
  });

  afterEach(() => {
    store().reset();
    __setFlipPointRngForTests();
    jest.useRealTimers();
  });

  it('is Titan level 2: three sets of five, a star a set', () => {
    expect(trainingLevelSpec(5, 2)).toMatchObject({ mode: 'flipPoint', sets: 3, handsPerSet: 5 });
    expect(store().targets).toEqual([1, 2, 3]);
    expect(store().status).toBe('idle');
  });

  it('a stop at the index is right; the reveal holds, then the next hand sweeps', () => {
    store().begin();
    const first = store().item!.play.id;
    rightStop();
    expect(store().handsInSet).toBe(1);
    expect(store().misses).toBe(0);
    expect(store().status).toBe('sweeping');
    expect(store().item!.play.id).not.toBe(first);
  });

  it('a stop far from the index costs a strike and shows where it was', () => {
    store().begin();
    const index = store().item!.play.index;
    const far = index >= 0 ? index - 3 : index + 3;
    expect(stopAt(far)).toBe(false);
    expect(store().status).toBe('reveal');
    expect(store().lastRight).toBe(false);
    expect(store().stopValue).toBeCloseTo(far, 1);
    expect(store().misses).toBe(1);
    expect(store().handsInSet).toBe(0);
  });

  it('a sweep that runs out is a strike with no stop', () => {
    store().begin();
    jest.advanceTimersByTime(store().spec!.sweepMs);
    expect(store().status).toBe('reveal');
    expect(store().stopValue).toBeNull();
    expect(store().misses).toBe(1);
    jest.advanceTimersByTime(FLIP_REVEAL_MS);
    expect(store().status).toBe('sweeping');
  });

  it('two sets clear the level and pause; keep going for the third star', () => {
    store().begin();
    for (let n = 0; n < 5; n++) {
      rightStop();
    }
    expect(store().setsDone).toBe(1);
    expect(store().stars).toBe(1);
    for (let n = 0; n < 5; n++) {
      rightStop();
    }
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(5, 2)]).toBe(2);
    store().keepGoing();
    for (let n = 0; n < 5; n++) {
      rightStop();
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(5, 2)]).toBe(3);
    expect(useDojoStore.getState().flashBests[flashLevelKey(5, 2)]?.run).toBe(15);
  });

  it('Stop at the clear banks two stars and ends the run', () => {
    store().begin();
    for (let n = 0; n < 10; n++) {
      rightStop();
    }
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(useDojoStore.getState().flashLevels[flashLevelKey(5, 2)]).toBe(2);
  });

  it('one miss past the strikes ends the run after its reveal', () => {
    store().begin();
    const strikes = store().spec!.strikes;
    for (let miss = 0; miss <= strikes; miss++) {
      jest.advanceTimersByTime(store().spec!.sweepMs);
      expect(store().status).toBe('reveal');
      jest.advanceTimersByTime(FLIP_REVEAL_MS);
    }
    expect(store().status).toBe('failed');
    expect(jest.getTimerCount()).toBe(0);
  });
});
