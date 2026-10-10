import { create } from 'zustand';
import {
  BusyTableDeal,
  BusyTableLevel,
  dealBusyTable,
  isClearingStars,
  meterDrainMs,
  STAR_COUNT,
  starsReached,
  StarTargets,
  starTargets,
  trainingLevelSpec,
} from '../engine/dojo';
import { defaultRng, Rng } from '../engine/shoe/rng';
import { useDailyGoalStore } from './dailyGoalStore';
import { TrainingLevelOutcome, useDojoStore } from './dojoStore';
import { MeterState, meterFillAt, StarBank } from './trainingStore';

/**
 * Busy Table — Kepler's level 2, one table at a time:
 *
 *   idle ──begin──▶ flashing ──(flashMs)──▶ asking ──right──▶ feedback ──▶ next table
 *                                             │
 *                                             └──wrong──▶ feedback (cards revealed) ──▶ next table
 *
 * A star per stage (spec.tablesPerStage tables right); the second clears the
 * level and pauses the run (`cleared` → keepGoing / stopRun), the third ends
 * it. A wrong count costs a strike; one more than the level's strikes ends
 * the run. The meter drains while the count is asked, a right count tops it
 * up, and running dry ends the run with the stars it banked.
 */
export type BusyTableStatus =
  | 'idle'
  | 'flashing'
  | 'asking'
  | 'feedback'
  | 'cleared'
  | 'levelComplete'
  | 'failed';

/** A right count tops the meter up this much. */
export const BUSY_TABLE_TOP_UP = 0.25;
/** A right answer lingers this long before the next table (ms). */
export const BUSY_TABLE_RIGHT_MS = 700;
/** A wrong answer shows the table face up with its values this long (ms). */
export const BUSY_TABLE_REVEAL_MS = 1500;

export interface BusyTableState {
  readonly mapId: number;
  readonly level: number;
  readonly spec: BusyTableLevel | null;
  readonly status: BusyTableStatus;
  readonly deal: BusyTableDeal | null;
  /** Bumps with every new table so the board and the stepper reset. */
  readonly dealSerial: number;
  /** 0-based stage being played. */
  readonly stageIndex: number;
  /** Tables answered right in the current stage. */
  readonly tablesRight: number;
  /** Stages finished this run. */
  readonly stagesDone: number;
  readonly misses: number;
  /** The last answer and whether it was right (null before the first). */
  readonly lastAnswer: { readonly value: number; readonly right: boolean } | null;
  readonly stars: number;
  readonly targets: StarTargets;
  readonly starBank: StarBank | null;
  readonly outcome: TrainingLevelOutcome | null;
  readonly meter: MeterState;
  readonly meterDrainMs: number;
  readonly timedOut: boolean;

  readonly load: (mapId: number, level: number) => void;
  readonly begin: () => void;
  /** The count of the whole table. Returns whether it was right. */
  readonly answer: (value: number) => boolean;
  readonly keepGoing: () => void;
  readonly stopRun: () => void;
  readonly reset: () => void;
}

type Timer = ReturnType<typeof setTimeout>;
const timers = new Set<Timer>();
let meterTimer: Timer | null = null;
let rng: Rng = defaultRng;
let bankSerial = 0;

/** Deterministic deals for tests. Pass nothing to restore the default. */
export function __setBusyTableRngForTests(next?: Rng): void {
  rng = next ?? defaultRng;
}

function clearAllTimers(): void {
  for (const timer of timers) {
    clearTimeout(timer);
  }
  timers.clear();
  meterTimer = null;
}

function schedule(fn: () => void, delay: number): Timer {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, delay);
  timers.add(timer);
  return timer;
}

function specFor(mapId: number, level: number): BusyTableLevel | null {
  try {
    const spec = trainingLevelSpec(mapId, level);
    return spec.mode === 'busyTable' ? spec : null;
  } catch {
    return null;
  }
}

export const useBusyTableStore = create<BusyTableState>()((set, get) => {
  /** The run's best is recorded once, when it ends. */
  let runSettled = false;

  function idle(mapId: number, level: number) {
    const spec = specFor(mapId, level);
    runSettled = false;
    return {
      mapId,
      level,
      spec,
      status: 'idle' as const,
      deal: null,
      dealSerial: 0,
      stageIndex: 0,
      tablesRight: 0,
      stagesDone: 0,
      misses: 0,
      lastAnswer: null,
      stars: 0,
      targets: spec ? starTargets(spec) : ([1, 2, 3] as StarTargets),
      starBank: null,
      outcome: null,
      meter: { fill: 1, at: Date.now(), draining: false },
      meterDrainMs: meterDrainMs(mapId, level),
      timedOut: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Meter
  // ---------------------------------------------------------------------------

  function cancelMeterTimer(): void {
    if (meterTimer) {
      clearTimeout(meterTimer);
      timers.delete(meterTimer);
      meterTimer = null;
    }
  }

  function drain(): void {
    const { meter, meterDrainMs: drainMs } = get();
    cancelMeterTimer();
    const now = Date.now();
    const fill = meterFillAt(meter, drainMs, now);
    set({ meter: { fill, at: now, draining: true } });
    meterTimer = schedule(meterEmpty, fill * drainMs);
  }

  function hold(): void {
    const { meter, meterDrainMs: drainMs } = get();
    cancelMeterTimer();
    const now = Date.now();
    set({ meter: { fill: meterFillAt(meter, drainMs, now), at: now, draining: false } });
  }

  function feed(amount: number): void {
    const { meter } = get();
    set({ meter: { ...meter, fill: Math.min(1, meter.fill + amount) } });
  }

  function meterEmpty(): void {
    set({ timedOut: true, meter: { fill: 0, at: Date.now(), draining: false } });
    endRun();
  }

  // ---------------------------------------------------------------------------
  // Run
  // ---------------------------------------------------------------------------

  function settleRun(): void {
    if (runSettled) {
      return;
    }
    runSettled = true;
    const { mapId, level, stagesDone } = get();
    useDojoStore.getState().recordTrainingBest(mapId, level, stagesDone, 0);
  }

  function endRun(): void {
    clearAllTimers();
    settleRun();
    set({ status: isClearingStars(get().stars) ? 'levelComplete' : 'failed' });
  }

  function bankStars(stars: number): void {
    const { mapId, level, outcome } = get();
    const dojo = useDojoStore.getState();
    const banked = dojo.completeTrainingLevel(mapId, level, stars);
    dojo.touchPractice();
    bankSerial += 1;
    set({
      stars,
      starBank: { stars, chips: banked.chipsAwarded, serial: bankSerial },
      outcome: {
        stars: banked.stars,
        firstClear: banked.firstClear || (outcome?.firstClear ?? false),
        tableUnlocked: banked.tableUnlocked || (outcome?.tableUnlocked ?? false),
        chipsAwarded: banked.chipsAwarded + (outcome?.chipsAwarded ?? 0),
        progression: banked.progression ?? outcome?.progression ?? null,
      },
    });
  }

  /** Deal the next table of `stageIndex` and flash it. */
  function dealTable(stageIndex: number): void {
    const { spec, dealSerial } = get();
    if (!spec) {
      return;
    }
    const stage = spec.stages[Math.min(stageIndex, spec.stages.length - 1)];
    set({
      status: 'flashing',
      deal: dealBusyTable(stage.deckCount, stage.seats, rng),
      dealSerial: dealSerial + 1,
      stageIndex,
    });
    schedule(() => {
      set({ status: 'asking' });
      drain();
    }, stage.flashMs);
  }

  /** A stage is finished: bank its star, then the next stage, the clear pause, or the end. */
  function stageDone(): void {
    const { stagesDone, targets, stars, spec, stageIndex } = get();
    const done = stagesDone + 1;
    set({ stagesDone: done, tablesRight: 0 });
    const reached = starsReached(targets, done);
    if (reached > stars) {
      bankStars(reached);
    }
    if (reached >= STAR_COUNT || !spec || stageIndex + 1 >= spec.stages.length) {
      endRun();
      return;
    }
    if (isClearingStars(reached) && !isClearingStars(stars)) {
      clearAllTimers();
      set({ status: 'cleared' });
      return;
    }
    set({ status: 'feedback' });
    schedule(() => dealTable(stageIndex + 1), BUSY_TABLE_RIGHT_MS);
  }

  return {
    ...idle(6, 2),

    load: (mapId, level) => {
      clearAllTimers();
      set(idle(mapId, level));
    },

    begin: () => {
      clearAllTimers();
      const { mapId, level } = get();
      set(idle(mapId, level));
      dealTable(0);
    },

    answer: (value) => {
      const { status, deal, spec, stageIndex, misses, tablesRight } = get();
      if (status !== 'asking' || !deal || !spec) {
        return false;
      }
      hold();
      const right = value === deal.count;
      set({ lastAnswer: { value, right } });
      if (right) {
        feed(BUSY_TABLE_TOP_UP);
        useDailyGoalStore.getState().noteTrainingAnswer();
        const count = tablesRight + 1;
        set({ tablesRight: count });
        if (count >= spec.tablesPerStage) {
          stageDone();
          return true;
        }
        set({ status: 'feedback' });
        schedule(() => dealTable(stageIndex), BUSY_TABLE_RIGHT_MS);
        return true;
      }
      const nextMisses = misses + 1;
      set({ misses: nextMisses });
      if (nextMisses > spec.strikes) {
        endRun();
        return false;
      }
      set({ status: 'feedback' });
      schedule(() => dealTable(stageIndex), BUSY_TABLE_REVEAL_MS);
      return false;
    },

    keepGoing: () => {
      const { status, stageIndex } = get();
      if (status !== 'cleared') {
        return;
      }
      dealTable(stageIndex + 1);
    },

    stopRun: () => {
      if (get().status !== 'cleared') {
        return;
      }
      clearAllTimers();
      settleRun();
      set({ status: 'levelComplete' });
    },

    reset: () => {
      clearAllTimers();
      if (get().status === 'cleared') {
        settleRun();
      }
      const { mapId, level } = get();
      set(idle(mapId, level));
    },
  };
});
