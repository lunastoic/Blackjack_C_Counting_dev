import { hiLoValue } from '../../engine/cards/card';
import {
  CountStreamLevel,
  flashLevelKey,
  FLASH_LEVELS_PER_MAP,
  SPEED_PROFILES,
  TableCountLevel,
  totalCheckpoints,
  TRAINING_MAPS,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import { useDojoStore } from '../../stores/dojoStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  __setTrainingRandomForTests,
  TrainingStatus,
  useTrainingStore,
} from '../../stores/trainingStore';

const store = () => useTrainingStore.getState();

function resetStores(): void {
  __resetPersistenceForTests();
  const defaults = createDefaultSave();
  // Most tests exercise the loops, not the one-time count tip.
  useDojoStore.getState().hydrate({ ...defaults.dojo, flashCountTipSeen: true });
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

  it('starts idle on the level brief with no clock anywhere', () => {
    expect(store().status).toBe('idle');
    expect(store().spec.title).toBe('Card Values');
    expect(store().speed).toBe(SPEED_PROFILES.beginner);
    expect(Object.keys(store()).some((key) => /timer|countdown|flashMs/i.test(key))).toBe(false);
  });

  it('shows one card at a time and clears at 21 straight (3 stars, level 2 opens)', () => {
    store().begin();
    expect(store().status).toBe('asking');
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
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(store().outcome).toMatchObject({ stars: 3, firstClear: true, tableUnlocked: false });
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 1)]).toBe(3);
    expect(useDojoStore.getState().isFlashLevelUnlocked(1, 2)).toBe(true);
  });

  it('a miss shows the answer, resets the streak and costs a star', () => {
    store().begin();
    answerCorrectly();
    answerCorrectly();
    expect(store().streak).toBe(2);

    answerWrongly();
    expect(store().status).toBe('feedback');
    expect(store().question?.wasCorrect).toBe(false);
    expect(store().question?.correct).toBeDefined();
    expect(store().streak).toBe(0);
    expect(store().resets).toBe(1);
    // The pad is dead while the correction shows.
    expect(store().answer(0)).toBe(false);
    jest.advanceTimersByTime(SPEED_PROFILES.beginner.missMs - 1);
    expect(store().status).toBe('feedback');
    jest.advanceTimersByTime(1);
    expect(store().status).toBe('asking');

    for (let n = 1; n <= 21; n++) {
      answerCorrectly();
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(2);
  });

  it('a run of right answers needs no timers at all', () => {
    store().begin();
    for (let n = 1; n <= 21; n++) {
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
    expect(store().status).toBe('levelComplete');
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
    for (let k = 0; k < totalCheckpoints(spec); k++) {
      advanceUntil('asking');
      expect(store().checkpointIndex).toBe(k);
      answerCorrectly();
      if (k < totalCheckpoints(spec) - 1) {
        expect(store().status).toBe('feedback');
        expect(store().tally.correct).toBe(k + 1);
      }
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 4)]).toBe(3);
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
    expect(store().status).toBe('levelComplete');
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
    expect(store().status).toBe('levelComplete');
    expect(store().outcome?.tableUnlocked).toBe(true);
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
