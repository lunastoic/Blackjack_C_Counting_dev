import { hiLoValue } from '../../engine/cards/card';
import {
  BusyTableLevel,
  busyTableCards,
  dealBusyTable,
  flashLevelKey,
  trainingLevelSpec,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import {
  __setBusyTableRngForTests,
  BUSY_TABLE_REVEAL_MS,
  BUSY_TABLE_RIGHT_MS,
  useBusyTableStore,
} from '../../stores/busyTableStore';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';

const store = () => useBusyTableStore.getState();
const spec = () => trainingLevelSpec(6, 2) as BusyTableLevel;

/** Let the current table's flash run out. */
function waitForQuestion(): void {
  const { stageIndex } = store();
  jest.advanceTimersByTime(spec().stages[stageIndex].flashMs);
  expect(store().status).toBe('asking');
}

function answerRight(): void {
  waitForQuestion();
  expect(store().answer(store().deal!.count)).toBe(true);
}

function answerWrong(): void {
  waitForQuestion();
  expect(store().answer(store().deal!.count + 1)).toBe(false);
}

/** Through the beat after an answer, to the next table's flash. */
function nextTable(ms = BUSY_TABLE_RIGHT_MS): void {
  jest.advanceTimersByTime(ms);
  expect(store().status).toBe('flashing');
}

describe('busy table — the deal', () => {
  it('deals the dealer two or three cards and every seat two or three, counted right', () => {
    for (let seed = 1; seed <= 80; seed++) {
      for (const seats of [3, 4]) {
        const deal = dealBusyTable(6, seats, seededRng(seed));
        expect(deal.seats).toHaveLength(seats);
        expect([2, 3]).toContain(deal.dealer.length);
        for (const hand of deal.seats) {
          expect([2, 3]).toContain(hand.length);
        }
        const cards = busyTableCards(deal);
        expect(deal.count).toBe(cards.reduce((sum, card) => sum + hiLoValue(card.rank), 0));
        // One shoe: no card is dealt twice.
        expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
      }
    }
  });

  it('is Kepler level 2: three stages, bigger shoes and shorter flashes, one strike', () => {
    const level = spec();
    expect(level.mode).toBe('busyTable');
    expect(level.stages.map((stage) => stage.deckCount)).toEqual([4, 6, 8]);
    expect(level.stages[2].flashMs).toBeLessThan(level.stages[0].flashMs);
    expect(level.strikes).toBe(1);
  });
});

describe('busy table — the level', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetPersistenceForTests();
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate(defaults.dojo);
    useEconomyStore.getState().hydrate(defaults.economy);
    useProgressionStore.getState().hydrate(defaults.progression);
    useSettingsStore.getState().hydrate(defaults.settings);
    __setBusyTableRngForTests(seededRng(9));
    store().load(6, 2);
  });

  afterEach(() => {
    store().reset();
    __setBusyTableRngForTests();
    jest.useRealTimers();
  });

  it('flashes the table, then asks with the meter draining; nothing counts mid-flash', () => {
    store().begin();
    expect(store().status).toBe('flashing');
    expect(store().deal).not.toBeNull();
    expect(store().meter.draining).toBe(false);
    expect(store().answer(store().deal!.count)).toBe(false);
    jest.advanceTimersByTime(spec().stages[0].flashMs - 1);
    expect(store().status).toBe('flashing');
    jest.advanceTimersByTime(1);
    expect(store().status).toBe('asking');
    expect(store().meter.draining).toBe(true);
  });

  it('a star per stage, a pause at the clear, three stars at the end', () => {
    store().begin();
    const perStage = spec().tablesPerStage;
    for (let stage = 0; stage < 2; stage++) {
      for (let table = 0; table < perStage; table++) {
        answerRight();
        if (!(stage === 1 && table === perStage - 1)) {
          nextTable();
        }
      }
      if (stage === 0) {
        expect(store().stars).toBe(1);
      }
    }
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(6, 2)]).toBe(2);
    store().keepGoing();
    expect(store().status).toBe('flashing');
    expect(store().stageIndex).toBe(2);
    expect(store().deal!.seats).toHaveLength(spec().stages[2].seats);
    for (let table = 0; table < perStage; table++) {
      answerRight();
      if (table < perStage - 1) {
        nextTable();
      }
    }
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(6, 2)]).toBe(3);
    expect(useDojoStore.getState().flashBests[flashLevelKey(6, 2)]?.run).toBe(3);
  });

  it('Stop at the clear banks two stars and ends the run', () => {
    store().begin();
    for (let i = 0; i < spec().tablesPerStage * 2; i++) {
      answerRight();
      if (store().status === 'feedback') {
        jest.advanceTimersByTime(BUSY_TABLE_RIGHT_MS);
      }
    }
    expect(store().status).toBe('cleared');
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a wrong count reveals the table, costs a strike and deals a fresh table in the same stage', () => {
    store().begin();
    answerRight();
    nextTable();
    answerWrong();
    expect(store().status).toBe('feedback');
    expect(store().misses).toBe(1);
    expect(store().lastAnswer?.right).toBe(false);
    expect(store().tablesRight).toBe(1);
    jest.advanceTimersByTime(BUSY_TABLE_REVEAL_MS - 1);
    expect(store().status).toBe('feedback');
    jest.advanceTimersByTime(1);
    expect(store().status).toBe('flashing');
    expect(store().stageIndex).toBe(0);
  });

  it('one strike to spare: the second wrong count ends the run', () => {
    store().begin();
    answerWrong();
    jest.advanceTimersByTime(BUSY_TABLE_REVEAL_MS);
    answerWrong();
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('running dry ends the run; a right count tops the meter up and holds it', () => {
    store().begin();
    waitForQuestion();
    jest.advanceTimersByTime(2000);
    store().answer(store().deal!.count);
    const held = store().meter;
    expect(held.draining).toBe(false);
    jest.advanceTimersByTime(BUSY_TABLE_RIGHT_MS);
    waitForQuestion();
    jest.advanceTimersByTime(store().meterDrainMs + 10);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(true);
  });
});
