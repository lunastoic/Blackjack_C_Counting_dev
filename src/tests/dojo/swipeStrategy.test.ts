import {
  DECISION,
  flashLevelKey,
  meterDrainMs,
  swipeComboMultiplier,
  swipeForDecision,
  swipeFromDrag,
  SWIPE_DECISION,
  trainingLevelSpec,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  __setSwipeStrategyRngForTests,
  SWIPE_MISS_MS,
  useSwipeStrategyStore,
} from '../../stores/swipeStrategyStore';
import { meterFillAt } from '../../stores/trainingStore';

const store = () => useSwipeStrategyStore.getState();

function answerRight(): void {
  expect(store().answer(store().item!.correct)).toBe(true);
}

function answerWrong(): void {
  const correct = store().item!.correct;
  const wrong = [DECISION.hit, DECISION.stand, DECISION.double, DECISION.split].find((code) => code !== correct)!;
  expect(store().answer(wrong)).toBe(false);
}

describe('swipe strategy — swipes', () => {
  it('reads a released drag by its dominant axis, past the threshold', () => {
    expect(swipeFromDrag(-120, 10)).toBe('left');
    expect(swipeFromDrag(120, -30)).toBe('right');
    expect(swipeFromDrag(20, -100)).toBe('up');
    expect(swipeFromDrag(-10, 90)).toBe('down');
    expect(swipeFromDrag(30, 40)).toBeNull();
  });

  it('maps swipes to plays: ← hit, → stand, ↑ double, ↓ split', () => {
    expect(SWIPE_DECISION).toEqual({
      left: DECISION.hit,
      right: DECISION.stand,
      up: DECISION.double,
      down: DECISION.split,
    });
    for (const code of [DECISION.hit, DECISION.stand, DECISION.double, DECISION.split]) {
      expect(SWIPE_DECISION[swipeForDecision(code)]).toBe(code);
    }
  });

  it('steps the combo multiplier up at 3, 6 and 10', () => {
    expect(swipeComboMultiplier(2)).toBe(1);
    expect(swipeComboMultiplier(3)).toBe(2);
    expect(swipeComboMultiplier(6)).toBe(3);
    expect(swipeComboMultiplier(10)).toBe(4);
  });
});

describe('swipe strategy — the level', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetPersistenceForTests();
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate(defaults.dojo);
    useEconomyStore.getState().hydrate(defaults.economy);
    useProgressionStore.getState().hydrate(defaults.progression);
    useSettingsStore.getState().hydrate(defaults.settings);
    __setSwipeStrategyRngForTests(seededRng(9));
    store().load(2, 2);
  });

  afterEach(() => {
    store().reset();
    __setSwipeStrategyRngForTests();
    jest.useRealTimers();
  });

  it('is Io Inferno level 2: three waves of ten, three strikes', () => {
    expect(trainingLevelSpec(2, 2)).toMatchObject({ mode: 'swipeStrategy', waves: 3, handsPerWave: 10, strikes: 3 });
    expect(store().spec).not.toBeNull();
    expect(store().targets).toEqual([1, 2, 3]);
    expect(store().status).toBe('idle');
  });

  it('deals a hand on begin; a right swipe deals the next at once', () => {
    store().begin();
    expect(store().status).toBe('playing');
    expect(store().item).not.toBeNull();
    const serial = store().itemSerial;
    expect(store().swipe(swipeForDecision(store().item!.correct))).toBe(true);
    expect(store().itemSerial).toBe(serial + 1);
    expect(store().handsInWave).toBe(1);
  });

  it('a star a wave, a pause at the clear, three stars at the end', () => {
    store().begin();
    for (let n = 0; n < 10; n++) {
      answerRight();
    }
    expect(store().stars).toBe(1);
    expect(store().wave).toBe(1);
    expect(store().status).toBe('playing');
    for (let n = 0; n < 10; n++) {
      answerRight();
    }
    expect(store().stars).toBe(2);
    expect(store().status).toBe('cleared');
    expect(useDojoStore.getState().flashLevels[flashLevelKey(2, 2)]).toBe(2);
    expect(useDojoStore.getState().isFlashLevelUnlocked(2, 3)).toBe(true);
    store().keepGoing();
    expect(store().status).toBe('playing');
    for (let n = 0; n < 10; n++) {
      answerRight();
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(2, 2)]).toBe(3);
    expect(useDojoStore.getState().flashBests[flashLevelKey(2, 2)]?.run).toBe(30);
  });

  it('Stop at the clear banks two stars and ends the run', () => {
    store().begin();
    for (let n = 0; n < 20; n++) {
      answerRight();
    }
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(2);
  });

  it('a wrong swipe shows the fix, costs a strike, then deals the next hand', () => {
    store().begin();
    const serial = store().itemSerial;
    answerWrong();
    expect(store().status).toBe('feedback');
    expect(store().misses).toBe(1);
    expect(store().lastAnswer?.wasCorrect).toBe(false);
    expect(store().combo).toBe(0);
    jest.advanceTimersByTime(SWIPE_MISS_MS);
    expect(store().status).toBe('playing');
    expect(store().itemSerial).toBe(serial + 1);
  });

  it('the fourth miss ends the run with nothing banked', () => {
    store().begin();
    for (let miss = 1; miss <= 3; miss++) {
      answerWrong();
      jest.advanceTimersByTime(SWIPE_MISS_MS);
      expect(store().status).toBe('playing');
    }
    answerWrong();
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(false);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(2, 2)]).toBeUndefined();
  });

  it('the meter drains while a hand is up, a right swipe tops it up, and empty ends the run', () => {
    store().begin();
    const drainMs = meterDrainMs(2, 2);
    expect(store().meter.draining).toBe(true);
    jest.advanceTimersByTime(4000);
    const before = meterFillAt(store().meter, drainMs, Date.now());
    answerRight();
    expect(meterFillAt(store().meter, drainMs, Date.now())).toBeCloseTo(Math.min(1, before + 0.25), 2);
    jest.advanceTimersByTime(drainMs * 2);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(true);
  });

  it('fast right swipes build a combo; answers outside play are ignored', () => {
    store().begin();
    for (let n = 0; n < 4; n++) {
      answerRight();
    }
    expect(store().combo).toBe(4);
    expect(store().comboBest).toBe(4);
    store().reset();
    expect(store().answer(DECISION.hit)).toBe(false);
  });
});
