import { hiLoValue } from '../../engine/cards/card';
import {
  CountStreamLevel,
  flashLevelKey,
  FLASH_LEVELS_PER_MAP,
  meterDrainMs,
  SPEED_PROFILES,
  TableCountLevel,
  totalCheckpoints,
  TRAINING_MAPS,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  __setTrainingRandomForTests,
  meterFillAt,
  TrainingStatus,
  useTrainingStore,
} from '../../stores/trainingStore';

const store = () => useTrainingStore.getState();

/** Where the meter stands right now, 0–1. */
function meterFill(): number {
  const { meter, meterDrainMs: drainMs } = store();
  return meterFillAt(meter, drainMs, Date.now());
}

function resetStores(): void {
  __resetPersistenceForTests();
  const defaults = createDefaultSave();
  // Most tests exercise the loops, not the one-time count tip.
  useDojoStore.getState().hydrate({ ...defaults.dojo, flashCountTipSeen: true });
  useEconomyStore.getState().hydrate(defaults.economy);
  useProgressionStore.getState().hydrate(defaults.progression);
  useSettingsStore.getState().hydrate(defaults.settings);
}

/** Deals vary in length — advance until the status lands. */
function advanceUntil(target: TrainingStatus, maxMs = 600_000): void {
  let waited = 0;
  while (store().status !== target && waited < maxMs) {
    jest.advanceTimersByTime(50);
    waited += 50;
  }
  expect(store().status).toBe(target);
}

function currentCorrect(): number {
  const { spec, item, question } = store();
  if (question && question.selected === null) {
    return question.correct;
  }
  if (item) {
    return item.kind === 'cards' ? item.correct : item.item.correct;
  }
  throw new Error(`nothing to answer on ${spec.title}`);
}

function answerCorrectly(): void {
  expect(store().answer(currentCorrect())).toBe(true);
}

function answerWrongly(): void {
  const question = store().question;
  const correct = currentCorrect();
  const wrong = question?.choices.find((choice) => choice !== correct) ?? correct + 1;
  expect(store().answer(wrong)).toBe(false);
}

describe('training store — streak drills', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStores();
    __setTrainingRandomForTests(seededRng(42), seededRng(42));
    store().load(1, 1);
  });

  afterEach(() => {
    store().reset();
    __setTrainingRandomForTests();
    jest.useRealTimers();
  });

  it('starts idle on the level brief with the meter full and still', () => {
    expect(store().status).toBe('idle');
    expect(store().spec.title).toBe('Card Values');
    expect(store().speed).toBe(SPEED_PROFILES.beginner);
    expect(store().meter).toMatchObject({ fill: 1, draining: false });
    expect(store().meterDrainMs).toBe(12_000);
    jest.advanceTimersByTime(60_000);
    expect(meterFill()).toBe(1);
    expect(store().status).toBe('idle');
  });

  it('shows one card at a time; a star at 11, the clear at 21 (level 2 opens), the third at 32', () => {
    const chipsBefore = useEconomyStore.getState().chips;
    store().begin();
    expect(store().status).toBe('asking');
    expect(store().targets).toEqual([11, 21, 32]);
    for (let n = 1; n <= 21; n++) {
      const item = store().item;
      expect(item?.kind).toBe('cards');
      if (item?.kind === 'cards') {
        expect(item.cards).toHaveLength(1);
        expect(item.correct).toBe(hiLoValue(item.cards[0].rank));
      }
      answerCorrectly();
      if (n < 21) {
        // Right answers never wait: the next card is up before any timer runs.
        expect(store().status).toBe('asking');
        expect(store().streak).toBe(n);
        expect(store().question).toBeNull();
      }
      if (n === 10) {
        expect(store().stars).toBe(0);
        expect(store().starBank).toBeNull();
      }
      if (n === 11) {
        // The first star is banked in passing: chips, no pause, no clear yet.
        expect(store().stars).toBe(1);
        expect(store().starBank).toMatchObject({ stars: 1, chips: 25 });
        expect(useEconomyStore.getState().chips).toBe(chipsBefore + 25);
        expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 1)]).toBe(1);
        expect(useDojoStore.getState().isFlashLevelUnlocked(1, 2)).toBe(false);
      }
    }
    // The second star clears the level and pauses the run.
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);
    expect(store().streak).toBe(21);
    expect(store().meter.draining).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(store().outcome).toMatchObject({ stars: 2, firstClear: true, tableUnlocked: false, chipsAwarded: 75 });
    expect(useEconomyStore.getState().chips).toBe(chipsBefore + 75);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 1)]).toBe(2);
    expect(useDojoStore.getState().isFlashLevelUnlocked(1, 2)).toBe(true);
    expect(store().answer(0)).toBe(false);

    // Keep going: the same run, eleven more for the third.
    store().keepGoing();
    expect(store().status).toBe('asking');
    expect(store().meter.draining).toBe(true);
    for (let n = 22; n <= 32; n++) {
      answerCorrectly();
      if (n < 32) {
        expect(store().status).toBe('asking');
      }
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(store().outcome).toMatchObject({ stars: 3, firstClear: true, chipsAwarded: 175 });
    expect(useEconomyStore.getState().chips).toBe(chipsBefore + 175);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 1)]).toBe(3);
  });

  it('Stop at the clear banks two stars and ends the run', () => {
    store().begin();
    for (let n = 1; n <= 21; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('cleared');
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(2);
    expect(store().outcome?.stars).toBe(2);
    expect(jest.getTimerCount()).toBe(0);
    // Keep going / Stop only mean something at the pause.
    store().keepGoing();
    expect(store().status).toBe('levelComplete');
  });

  it('a clear records the run’s pace — right answers a minute — and keeps the level’s best', () => {
    store().begin();
    for (let n = 1; n <= 21; n++) {
      jest.advanceTimersByTime(1_000);
      answerCorrectly();
    }
    expect(store().status).toBe('cleared');
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(store().pace).toBe(60);
    expect(store().paceIsBest).toBe(true);
    expect(useDojoStore.getState().flashPace[flashLevelKey(1, 1)]).toBe(60);

    // A slower run keeps the best on the ladder and says so.
    store().reset();
    store().load(1, 1);
    store().begin();
    for (let n = 1; n <= 21; n++) {
      jest.advanceTimersByTime(2_000);
      answerCorrectly();
    }
    store().stopRun();
    expect(store().pace).toBe(30);
    expect(store().paceIsBest).toBe(false);
    expect(useDojoStore.getState().flashPace[flashLevelKey(1, 1)]).toBe(60);
  });

  it('a failed run records no pace', () => {
    store().begin();
    for (let n = 1; n <= 4; n++) {
      jest.advanceTimersByTime(500);
      answerWrongly();
      jest.advanceTimersByTime(5_000);
    }
    expect(store().status).toBe('failed');
    expect(store().pace).toBeNull();
    expect(useDojoStore.getState().flashPace[flashLevelKey(1, 1)]).toBeUndefined();
  });

  it('a star already paid on a level pays nothing again; a higher one still does', () => {
    const chipsBefore = useEconomyStore.getState().chips;
    store().begin();
    for (let n = 1; n <= 21; n++) {
      answerCorrectly();
    }
    store().stopRun();
    expect(useEconomyStore.getState().chips).toBe(chipsBefore + 75);

    store().begin();
    for (let n = 1; n <= 21; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('cleared');
    expect(store().starBank).toMatchObject({ stars: 2, chips: 0 });
    expect(store().outcome).toMatchObject({ stars: 2, firstClear: false, chipsAwarded: 0 });
    expect(useEconomyStore.getState().chips).toBe(chipsBefore + 75);
    store().keepGoing();
    for (let n = 22; n <= 32; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('levelComplete');
    expect(store().outcome).toMatchObject({ stars: 3, firstClear: false, chipsAwarded: 100 });
    expect(useEconomyStore.getState().chips).toBe(chipsBefore + 175);
  });

  it('running out of strikes on the stretch keeps the clear: the run ends complete at two stars', () => {
    store().begin();
    for (let n = 1; n <= 21; n++) {
      answerCorrectly();
    }
    store().keepGoing();
    for (let strike = 1; strike <= 3; strike++) {
      answerWrongly();
      jest.advanceTimersByTime(SPEED_PROFILES.beginner.missMs);
    }
    answerWrongly();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(2);
    expect(store().question?.wasCorrect).toBe(false);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 1)]).toBe(2);
  });

  it('a run that ends with one star banked fails the level but keeps the star', () => {
    store().begin();
    for (let n = 1; n <= 11; n++) {
      answerCorrectly();
    }
    expect(store().stars).toBe(1);
    for (let strike = 1; strike <= 3; strike++) {
      answerWrongly();
      jest.advanceTimersByTime(SPEED_PROFILES.beginner.missMs);
    }
    answerWrongly();
    expect(store().status).toBe('failed');
    expect(store().stars).toBe(1);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 1)]).toBe(1);
    expect(useDojoStore.getState().isFlashLevelUnlocked(1, 2)).toBe(false);
  });

  it('a miss shows the answer and costs a strike and a star, not the count', () => {
    store().begin();
    answerCorrectly();
    answerCorrectly();
    expect(store().streak).toBe(2);

    answerWrongly();
    expect(store().status).toBe('feedback');
    expect(store().question?.wasCorrect).toBe(false);
    expect(store().question?.correct).toBeDefined();
    expect(store().streak).toBe(2);
    expect(store().misses).toBe(1);
    // The pad is dead while the correction shows.
    expect(store().answer(0)).toBe(false);
    jest.advanceTimersByTime(SPEED_PROFILES.beginner.missMs - 1);
    expect(store().status).toBe('feedback');
    jest.advanceTimersByTime(1);
    expect(store().status).toBe('asking');

    // 19 more right answers finish the 21, not a fresh 21.
    for (let n = 1; n <= 19; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);
  });

  it('map 1 forgives three strikes; the fourth miss ends the run on its correction', () => {
    store().begin();
    expect(store().spec).toMatchObject({ strikes: 3 });
    for (let strike = 1; strike <= 3; strike++) {
      answerCorrectly();
      answerWrongly();
      expect(store().status).toBe('feedback');
      expect(store().misses).toBe(strike);
      jest.advanceTimersByTime(SPEED_PROFILES.beginner.missMs);
      expect(store().status).toBe('asking');
    }

    answerWrongly();
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(false);
    expect(store().misses).toBe(4);
    expect(store().streak).toBe(3);
    expect(store().question).toMatchObject({ wasCorrect: false });
    expect(store().meter.draining).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    // Dead pad; no correction timer brings the next card.
    expect(store().answer(0)).toBe(false);
    jest.advanceTimersByTime(60_000);
    expect(store().status).toBe('failed');
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 1)]).toBeUndefined();

    // Try again is a clean 21 with all three strikes back.
    store().begin();
    expect(store()).toMatchObject({ status: 'asking', streak: 0, misses: 0 });
  });

  it('three strikes used still clears: misses cost strikes, never stars', () => {
    store().begin();
    for (let strike = 1; strike <= 3; strike++) {
      answerWrongly();
      jest.advanceTimersByTime(SPEED_PROFILES.beginner.missMs);
    }
    for (let n = 1; n <= 21; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);
  });

  it('strikes taper by map — two, then one, then none: a first miss on map 4 ends the run', () => {
    store().load(2, 1);
    expect(store().spec).toMatchObject({ streakTarget: 21, strikes: 2 });
    store().load(3, 1);
    expect(store().spec).toMatchObject({ streakTarget: 21, strikes: 1 });
    store().begin();
    answerWrongly();
    expect(store().status).toBe('feedback');
    jest.advanceTimersByTime(SPEED_PROFILES.normal.missMs);
    answerWrongly();
    expect(store().status).toBe('failed');

    store().load(4, 1);
    expect(store().spec).toMatchObject({ streakTarget: 21, strikes: 0 });
    store().begin();
    answerCorrectly();
    answerWrongly();
    expect(store().status).toBe('failed');
    expect(store().misses).toBe(1);
  });

  it('a run of right answers leaves no timers behind', () => {
    store().begin();
    for (let n = 1; n <= 21; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('cleared');
    expect(jest.getTimerCount()).toBe(0);
    store().keepGoing();
    for (let n = 22; n <= 32; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('levelComplete');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('card groups grow 3 → 4 → 5 through the level', () => {
    store().load(1, 3);
    store().begin();
    const sizes = new Set<number>();
    for (let n = 1; n <= 21; n++) {
      const item = store().item;
      if (item?.kind === 'cards') {
        sizes.add(item.cards.length);
        expect(item.correct).toBe(item.cards.reduce((s, c) => s + hiLoValue(c.rank), 0));
      }
      answerCorrectly();
    }
    expect([...sizes].sort()).toEqual([3, 4, 5]);
    expect(store().status).toBe('cleared');
  });

  it('deck estimation and true-count drills serve their own items', () => {
    store().load(3, 2);
    store().begin();
    expect(store().item?.kind).toBe('deckEstimate');
    answerCorrectly();
    expect(store().status).toBe('asking');
    expect(store().streak).toBe(1);

    store().load(4, 1);
    store().begin();
    expect(store().item?.kind).toBe('trueCount');
    const item = store().item;
    if (item?.kind === 'trueCount') {
      expect(Number.isInteger(item.item.correct)).toBe(true);
      expect(item.item.choices).toContain(item.item.correct);
    }
    answerCorrectly();
    expect(store().status).toBe('asking');
    expect(store().streak).toBe(1);
  });

  it('answers outside asking are ignored', () => {
    expect(store().answer(0)).toBe(false);
    store().begin();
    answerWrongly();
    expect(store().answer(0)).toBe(false);
  });
});

describe('training store — answer meter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStores();
    __setTrainingRandomForTests(seededRng(42), seededRng(42));
    store().load(1, 1);
  });

  afterEach(() => {
    store().reset();
    __setTrainingRandomForTests();
    jest.useRealTimers();
  });

  it('starts full on Start and drains while the card waits for an answer', () => {
    store().begin();
    expect(store().meter).toMatchObject({ fill: 1, draining: true });
    jest.advanceTimersByTime(3_000);
    expect(meterFill()).toBeCloseTo(0.75);
    jest.advanceTimersByTime(3_000);
    expect(meterFill()).toBeCloseTo(0.5);
    expect(store().status).toBe('asking');
  });

  it('running dry fails the run; Try again starts over full', () => {
    store().begin();
    answerCorrectly();
    jest.advanceTimersByTime(12_000 - 1);
    expect(store().status).toBe('asking');
    jest.advanceTimersByTime(1);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(true);
    expect(meterFill()).toBe(0);
    expect(store().answer(0)).toBe(false);
    expect(jest.getTimerCount()).toBe(0);

    store().begin();
    expect(store().status).toBe('asking');
    expect(store().timedOut).toBe(false);
    expect(store().streak).toBe(0);
    expect(store().meter).toMatchObject({ fill: 1, draining: true });
  });

  it('every right answer tops it up by a quarter, never past full', () => {
    store().begin();
    jest.advanceTimersByTime(6_000);
    expect(meterFill()).toBeCloseTo(0.5);
    answerCorrectly();
    expect(meterFill()).toBeCloseTo(0.75);
    answerCorrectly();
    expect(meterFill()).toBeCloseTo(1);
    answerCorrectly();
    expect(meterFill()).toBeCloseTo(1);
    // The top-up bought time: empty is a full drain away again.
    jest.advanceTimersByTime(12_000 - 1);
    expect(store().status).toBe('asking');
    jest.advanceTimersByTime(1);
    expect(store().status).toBe('failed');
  });

  it('a miss neither tops it up nor drains it while the correction shows', () => {
    store().begin();
    jest.advanceTimersByTime(3_000);
    answerWrongly();
    expect(store().status).toBe('feedback');
    expect(store().meter).toMatchObject({ draining: false });
    expect(meterFill()).toBeCloseTo(0.75);
    jest.advanceTimersByTime(SPEED_PROFILES.beginner.missMs);
    expect(store().status).toBe('asking');
    expect(meterFill()).toBeCloseTo(0.75);
    jest.advanceTimersByTime(9_000 - 1);
    expect(store().status).toBe('asking');
    jest.advanceTimersByTime(1);
    expect(store().status).toBe('failed');
  });

  it('on a count stream it waits while the cards deal and only runs at the checks', () => {
    store().load(1, 4);
    store().begin();
    expect(store().meter).toMatchObject({ fill: 1, draining: false });
    advanceUntil('asking');
    expect(meterFill()).toBe(1);
    expect(store().meter.draining).toBe(true);
    const drainMs = store().meterDrainMs;
    expect(drainMs).toBe(11_400);
    jest.advanceTimersByTime(drainMs / 2);
    answerCorrectly();
    expect(store().status).toBe('feedback');
    expect(store().meter.draining).toBe(false);
    expect(meterFill()).toBeCloseTo(0.75);
    advanceUntil('asking');
    expect(meterFill()).toBeCloseTo(0.75);
    jest.advanceTimersByTime(drainMs);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(true);
  });

  it('only ever gets faster up the ladder: every level drains no slower than the last, and every casino faster than the one before', () => {
    expect(meterDrainMs(1, 1)).toBe(12_000);
    let previous = Number.POSITIVE_INFINITY;
    for (const map of TRAINING_MAPS) {
      for (const spec of map.levels) {
        const drainMs = meterDrainMs(map.mapId, spec.level);
        expect(drainMs).toBeLessThanOrEqual(previous);
        expect(drainMs).toBeGreaterThanOrEqual(4_000);
        previous = drainMs;
      }
    }
    for (let level = 1; level <= FLASH_LEVELS_PER_MAP; level++) {
      for (let mapId = 2; mapId <= TRAINING_MAPS.length; mapId++) {
        expect(meterDrainMs(mapId, level)).toBeLessThan(meterDrainMs(mapId - 1, level));
      }
    }
  });
});

describe('training store — count streams', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStores();
    __setTrainingRandomForTests(seededRng(7), seededRng(7));
    store().load(1, 4);
  });

  afterEach(() => {
    store().reset();
    __setTrainingRandomForTests();
    jest.useRealTimers();
  });

  it('streams cards, pauses at checkpoints for the actual count, and never shows the count', () => {
    store().begin();
    expect(store().status).toBe('running');
    expect(store().script).not.toBeNull();
    advanceUntil('asking');

    const { frame, question, script } = store();
    expect(frame).not.toBeNull();
    expect(question?.kind).toBe('runningCount');
    expect(question?.correct).toBe(frame?.runningCount);
    expect(question?.choices).toHaveLength(4);
    expect(question?.choices).toContain(question?.correct);
    expect(script?.checkpoints[0].frameIndex).toBe(store().frameIndex);
    // The count is derived from every card dealt so far.
    const seen = script!.frames.slice(0, store().frameIndex + 1);
    expect(seen.reduce((sum, f) => sum + hiLoValue(f.card!.rank), 0)).toBe(question?.correct);
  });

  it('clears the level after every checkpoint is right; the count continues between checks', () => {
    store().begin();
    const spec = store().spec as CountStreamLevel;
    expect(store().targets).toEqual([5, 10, 15]);
    for (let k = 0; k < totalCheckpoints(spec); k++) {
      advanceUntil('asking');
      expect(store().checkpointIndex).toBe(k);
      answerCorrectly();
      if (k < totalCheckpoints(spec) - 1) {
        expect(store().status).toBe('feedback');
        expect(store().tally.correct).toBe(k + 1);
      }
      // The first star lands at the fifth check without stopping the stream.
      if (k < totalCheckpoints(spec) - 1) {
        expect(store().stars).toBe(k + 1 >= 5 ? 1 : 0);
      }
    }
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);
    expect(store().stretch).toBe(false);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 4)]).toBe(2);
    expect(useDojoStore.getState().isFlashLevelUnlocked(1, 5)).toBe(true);

    // The stretch: a fresh shoe, five more checks, the count from 0 again.
    store().keepGoing();
    expect(store().status).toBe('running');
    expect(store().stretch).toBe(true);
    expect(store().frameIndex).toBe(-1);
    expect(store().checkpointIndex).toBe(0);
    expect(store().script?.checkpoints).toHaveLength(5);
    for (let k = 0; k < 5; k++) {
      advanceUntil('asking');
      const { frame, question, script } = store();
      const seen = script!.frames.slice(0, store().frameIndex + 1);
      expect(seen.reduce((sum, f) => sum + hiLoValue(f.card!.rank), 0)).toBe(frame?.runningCount);
      expect(question?.correct).toBe(frame?.runningCount);
      answerCorrectly();
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(store().tally.asked).toBe(15);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 4)]).toBe(3);
  });

  it('a miss on the stretch of an all-correct level ends the run cleared at two stars', () => {
    store().begin();
    for (let k = 0; k < 10; k++) {
      advanceUntil('asking');
      answerCorrectly();
    }
    store().keepGoing();
    advanceUntil('asking');
    answerWrongly();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(2);
    expect(store().question?.wasCorrect).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 4)]).toBe(2);
  });

  it('a wrong count on an all-correct level fails the run, shows the review, and can restart from zero', () => {
    store().begin();
    advanceUntil('asking');
    answerCorrectly();
    advanceUntil('asking');
    const before = store().countAtLastCheck;
    answerWrongly();
    expect(store().status).toBe('failed');
    expect(store().question?.wasCorrect).toBe(false);
    expect(store().cardsSinceCheck.length).toBeGreaterThan(0);
    expect(
      before + store().cardsSinceCheck.reduce((sum, card) => sum + hiLoValue(card.rank), 0),
    ).toBe(store().question?.correct);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 4)]).toBeUndefined();

    store().begin();
    expect(store().status).toBe('running');
    expect(store().tally.asked).toBe(0);
    expect(store().checkpointIndex).toBe(0);
    expect(store().frameIndex).toBe(-1);
  });

  it('a full deck ends with the final count question at 0', () => {
    store().load(1, 5);
    store().begin();
    const spec = store().spec as CountStreamLevel;
    for (let k = 0; k < spec.checkpoints; k++) {
      advanceUntil('asking');
      expect(store().question?.isFinal).toBe(false);
      answerCorrectly();
    }
    advanceUntil('asking');
    expect(store().question?.isFinal).toBe(true);
    expect(store().question?.correct).toBe(0);
    expect(store().frameIndex).toBe(51);
    answerCorrectly();
    expect(store().status).toBe('cleared');

    // The stretch deals the whole deck again, so its final count is 0 too.
    store().keepGoing();
    expect(store().script?.frames).toHaveLength(52);
    expect(store().script?.checkpoints).toHaveLength(5);
    for (let k = 0; k < 4; k++) {
      advanceUntil('asking');
      expect(store().question?.isFinal).toBe(false);
      answerCorrectly();
    }
    advanceUntil('asking');
    expect(store().question?.isFinal).toBe(true);
    expect(store().question?.correct).toBe(0);
    expect(store().frameIndex).toBe(51);
    answerCorrectly();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
  });

  it('paired checkpoints ask decks remaining, then the true count from the decks shown', () => {
    store().load(4, 4);
    store().begin();
    advanceUntil('asking');
    const first = store().question!;
    expect(first.kind).toBe('decksRemaining');
    expect(first.partIndex).toBe(0);
    expect(first.partCount).toBe(2);
    answerCorrectly();
    expect(store().status).toBe('asking');
    const second = store().question!;
    expect(second.kind).toBe('trueCount');
    expect(second.partIndex).toBe(1);
    expect(second.givens).toEqual([{ kind: 'decksRemaining', correct: first.correct }]);
    answerCorrectly();
    expect(store().status).toBe('feedback');
    expect(store().tally.correct).toBe(1);
    expect(store().tally.byKind.decksRemaining.correct).toBe(1);
    expect(store().tally.byKind.trueCount.correct).toBe(1);
  });

  it('a level that allows misses continues after a wrong answer and can still pass', () => {
    store().load(4, 4); // 10 checks, 9 needed
    store().begin();
    advanceUntil('asking');
    answerWrongly();
    expect(store().status).toBe('feedback');
    expect(store().tally.asked).toBe(1);
    expect(store().tally.correct).toBe(0);
    store().continueAfterMiss();
    expect(store().status).toBe('running');
    for (let k = 1; k < 10; k++) {
      advanceUntil('asking');
      answerCorrectly();
      if (store().status === 'asking') {
        answerCorrectly(); // second part
      }
    }
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);

    // The one allowed miss is spent for the whole run: a second on the stretch ends it.
    store().keepGoing();
    advanceUntil('asking');
    answerWrongly();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(2);
  });

  it('exact-entry levels offer no choices', () => {
    store().load(6, 1);
    store().begin();
    advanceUntil('asking');
    expect(store().question?.choices).toEqual([]);
    expect(store().answer(store().question!.correct)).toBe(true);
  });

  it('pauses for the count tip on the first correct check ever', () => {
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate({ ...defaults.dojo, flashCountTipSeen: false });
    store().begin();
    advanceUntil('asking');
    answerCorrectly();
    expect(store().status).toBe('feedback');
    expect(store().countTipPending).toBe(true);
    jest.advanceTimersByTime(10_000);
    expect(store().status).toBe('feedback');
    store().acknowledgeCountTip();
    expect(useDojoStore.getState().flashCountTipSeen).toBe(true);
    expect(store().status).toBe('running');
  });
});

describe('training store — live tables', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStores();
    __setTrainingRandomForTests(seededRng(11), seededRng(11));
  });

  afterEach(() => {
    store().reset();
    __setTrainingRandomForTests();
    jest.useRealTimers();
  });

  it('Map 1 level 6 is the blackjack count test and completing it opens the table and the next casino', () => {
    const dojo = useDojoStore.getState();
    for (let level = 1; level < FLASH_LEVELS_PER_MAP; level++) {
      expect(dojo.completeTrainingLevel(1, level, 3).tableUnlocked).toBe(false);
    }
    expect(useProgressionStore.getState().licenseForMap(1)).toBe('none');
    expect(useProgressionStore.getState().isMapUnlocked(2)).toBe(false);

    store().load(1, 6);
    const spec = store().spec as TableCountLevel;
    expect(spec).toMatchObject({ mode: 'tableCount', play: 'autoplay', deckCount: 1, checkpoints: 6 });
    store().begin();
    for (let k = 0; k < 6; k++) {
      advanceUntil('asking');
      const { frame, question } = store();
      expect(question?.correct).toBe(frame?.runningCount);
      expect(frame?.table.dealer).not.toBeNull();
      answerCorrectly();
    }
    // Two stars on the sixth level open the table; the third is optional.
    expect(store().status).toBe('cleared');
    expect(store().outcome?.tableUnlocked).toBe(true);
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(useDojoStore.getState().isMapFlashComplete(1)).toBe(true);
    expect(useDojoStore.getState().nextFlashLevel(1)).toBeNull();
    expect(useProgressionStore.getState().licenseForMap(1)).toBe('licensed');
    expect(useProgressionStore.getState().isMapUnlocked(2)).toBe(true);
  });

  it('paces table beats from the speed preset, not the settings dealer speed', () => {
    useSettingsStore.getState().setDealerSpeed(2);
    store().load(1, 6);
    store().begin();
    jest.advanceTimersByTime(500);
    expect(store().frameIndex).toBe(0);
    jest.advanceTimersByTime(SPEED_PROFILES.normal.table.card - 10);
    expect(store().frameIndex).toBe(0);
    jest.advanceTimersByTime(20);
    expect(store().frameIndex).toBe(1);
  });

  it('the whole ladder is playable: every level of every casino clears and unlocks the next', () => {
    __setTrainingRandomForTests(seededRng(7), seededRng(7));
    for (const map of TRAINING_MAPS) {
      expect(useProgressionStore.getState().isMapUnlocked(map.mapId)).toBe(true);
      for (const spec of map.levels) {
        expect(useDojoStore.getState().isFlashLevelUnlocked(map.mapId, spec.level)).toBe(true);
        expect(useDojoStore.getState().isFlashLevelUnlocked(map.mapId, spec.level + 1)).toBe(false);
        store().load(map.mapId, spec.level);
        store().begin();
        let guard = 0;
        while (store().status !== 'levelComplete' && guard++ < 2000) {
          if (store().status === 'cleared') {
            expect(store().stars).toBe(2);
            store().keepGoing();
          }
          advanceUntil('asking');
          answerCorrectly();
          if (store().status === 'feedback') {
            jest.advanceTimersByTime(store().speed.feedbackMs);
          }
          if (store().countTipPending) {
            store().acknowledgeCountTip();
          }
        }
        expect(store().status).toBe('levelComplete');
        expect(store().stars).toBe(3);
        expect(useDojoStore.getState().flashLevels[flashLevelKey(map.mapId, spec.level)]).toBe(3);
        store().reset();
      }
      expect(useDojoStore.getState().isMapFlashComplete(map.mapId)).toBe(true);
      expect(useProgressionStore.getState().licenseForMap(map.mapId)).toBe('licensed');
    }
  });

  it('the final exam tallies accuracy per question kind and fails early when out of reach', () => {
    store().load(6, 6);
    store().begin();
    let misses = 0;
    while (store().status !== 'failed' && misses < 3) {
      advanceUntil('asking');
      answerWrongly();
      misses += 1;
      if (store().status === 'feedback') {
        store().continueAfterMiss();
      }
    }
    expect(store().status).toBe('failed');
    const { tally } = store();
    expect(tally.asked).toBe(misses);
    expect(tally.correct).toBe(0);
    const askedByKind = Object.values(tally.byKind).reduce((sum, entry) => sum + entry.asked, 0);
    expect(askedByKind).toBe(misses);
  });
});
