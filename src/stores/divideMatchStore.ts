import { create } from 'zustand';
import {
  DivideGrid,
  DivideMatchLevel,
  isClearingStars,
  isGridClear,
  makeDivideGrid,
  matchTiles,
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
 * Divide and Match — Europa Ice's level 2, one grid at a time:
 *
 *   idle ──begin──▶ playing ──(drop / tap pairs)──▶ grid clear ──▶ next grid
 *
 * A star per grid; the second clears the level and pauses the run
 * (`cleared` → keepGoing / stopRun), the third ends it. A count paired with
 * a deck tile that doesn't make the target (or two tiles of the same kind)
 * costs a strike; one more than the level's strikes ends the run.
 *
 * The meter drains the whole time a grid is on the felt and every match
 * tops it up a little, a finished grid a lot. Running dry ends the run with
 * the stars it banked.
 */
export type DivideMatchStatus = 'idle' | 'playing' | 'feedback' | 'cleared' | 'levelComplete' | 'failed';

/** A miss on the board, for the felt to shake. */
export interface DivideMiss {
  readonly ids: readonly number[];
  readonly serial: number;
}

/** Each match tops the meter up this much. */
export const DIVIDE_MATCH_TOP_UP = 0.12;
/** Finishing a grid tops it up this much on top. */
export const DIVIDE_GRID_TOP_UP = 0.25;
/** A beat between one grid and the next (ms). */
const NEXT_GRID_MS = 600;

export interface DivideMatchState {
  readonly mapId: number;
  readonly level: number;
  readonly spec: DivideMatchLevel | null;
  readonly status: DivideMatchStatus;
  readonly grid: DivideGrid | null;
  /** Bumps with every new grid so the board can deal it in. */
  readonly gridSerial: number;
  /** 0-based index into the level's grids. */
  readonly gridIndex: number;
  /** Grids finished this run. */
  readonly gridsDone: number;
  /** Pairs matched this run. */
  readonly matches: number;
  /** A tile picked by a tap, waiting for its partner. */
  readonly selected: number | null;
  readonly misses: number;
  readonly lastMiss: DivideMiss | null;
  readonly stars: number;
  readonly targets: StarTargets;
  readonly starBank: StarBank | null;
  readonly outcome: TrainingLevelOutcome | null;
  readonly meter: MeterState;
  readonly meterDrainMs: number;
  readonly timedOut: boolean;

  readonly load: (mapId: number, level: number) => void;
  readonly begin: () => void;
  /** Drag tile `from` onto tile `to`. Returns whether they matched. */
  readonly drop: (from: number, to: number) => boolean;
  /** Tap a tile: picks it, or pairs it with the one picked. */
  readonly tap: (id: number) => boolean;
  readonly keepGoing: () => void;
  readonly stopRun: () => void;
  readonly reset: () => void;
}

type Timer = ReturnType<typeof setTimeout>;
const timers = new Set<Timer>();
let meterTimer: Timer | null = null;
let rng: Rng = defaultRng;
let missSerial = 0;
let bankSerial = 0;

/** Deterministic grids for tests. Pass nothing to restore the default. */
export function __setDivideMatchRngForTests(next?: Rng): void {
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

function specFor(mapId: number, level: number): DivideMatchLevel | null {
  try {
    const spec = trainingLevelSpec(mapId, level);
    return spec.mode === 'divideMatch' ? spec : null;
  } catch {
    return null;
  }
}

export const useDivideMatchStore = create<DivideMatchState>()((set, get) => {
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
      grid: null,
      gridSerial: 0,
      gridIndex: 0,
      gridsDone: 0,
      matches: 0,
      selected: null,
      misses: 0,
      lastMiss: null,
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

  /** Top the meter up and keep it draining if it was. */
  function feed(amount: number): void {
    const { meter, meterDrainMs: drainMs } = get();
    const now = Date.now();
    const fill = Math.min(1, meterFillAt(meter, drainMs, now) + amount);
    set({ meter: { fill, at: now, draining: meter.draining } });
    if (meter.draining) {
      cancelMeterTimer();
      meterTimer = schedule(meterEmpty, fill * drainMs);
    }
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
    const { mapId, level, gridsDone } = get();
    useDojoStore.getState().recordTrainingBest(mapId, level, gridsDone, 0);
  }

  function endRun(): void {
    clearAllTimers();
    settleRun();
    set({ status: isClearingStars(get().stars) ? 'levelComplete' : 'failed', selected: null });
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

  function dealGrid(index: number): void {
    const { spec, gridSerial } = get();
    if (!spec) {
      return;
    }
    const gridSpec = spec.grids[Math.min(index, spec.grids.length - 1)];
    set({
      status: 'playing',
      grid: makeDivideGrid(
        { rows: gridSpec.rows, cols: gridSpec.cols, maxDecks: spec.maxDecks, halfDecks: spec.halfDecks },
        rng,
      ),
      gridSerial: gridSerial + 1,
      gridIndex: index,
      selected: null,
    });
    drain();
  }

  /** A grid is finished: bank its star, then the next grid, the clear pause, or the end. */
  function gridDone(): void {
    const { gridsDone, targets, stars, spec, gridIndex } = get();
    const done = gridsDone + 1;
    feed(DIVIDE_GRID_TOP_UP);
    hold();
    useDailyGoalStore.getState().noteTrainingAnswer();
    set({ gridsDone: done, selected: null });
    const reached = starsReached(targets, done);
    if (reached > stars) {
      bankStars(reached);
    }
    if (reached >= STAR_COUNT || !spec || gridIndex + 1 >= spec.grids.length) {
      endRun();
      return;
    }
    if (isClearingStars(reached) && !isClearingStars(stars)) {
      clearAllTimers();
      set({ status: 'cleared' });
      return;
    }
    set({ status: 'feedback' });
    schedule(() => dealGrid(gridIndex + 1), NEXT_GRID_MS);
  }

  /** A pair cleared: carry on, or finish the grid. */
  function afterMatch(grid: DivideGrid): void {
    set({ grid, selected: null, matches: get().matches + 1 });
    feed(DIVIDE_MATCH_TOP_UP);
    if (isGridClear(grid)) {
      gridDone();
    }
  }

  /** A strike. Returns false when it ended the run. */
  function strike(ids: readonly number[]): boolean {
    const misses = get().misses + 1;
    missSerial += 1;
    set({ misses, lastMiss: { ids, serial: missSerial }, selected: null });
    if (misses > (get().spec?.strikes ?? 0)) {
      endRun();
      return false;
    }
    return true;
  }

  function tryPair(a: number, b: number): boolean {
    const { grid } = get();
    if (!grid) {
      return false;
    }
    const result = matchTiles(grid, a, b);
    if (result.ok) {
      afterMatch(result.grid);
      return true;
    }
    if (result.reason !== 'missing') {
      strike([a, b]);
    }
    return false;
  }

  return {
    ...idle(3, 2),

    load: (mapId, level) => {
      clearAllTimers();
      set(idle(mapId, level));
    },

    begin: () => {
      clearAllTimers();
      const { mapId, level } = get();
      set(idle(mapId, level));
      dealGrid(0);
    },

    drop: (from, to) => {
      const { status, grid } = get();
      if (status !== 'playing' || !grid || from === to) {
        return false;
      }
      return tryPair(from, to);
    },

    tap: (id) => {
      const { status, grid, selected } = get();
      if (status !== 'playing' || !grid || !grid.cells.some((cell) => cell?.id === id)) {
        return false;
      }
      if (selected === null || selected === id) {
        set({ selected: selected === id ? null : id });
        return true;
      }
      return tryPair(selected, id);
    },

    keepGoing: () => {
      const { status, gridIndex } = get();
      if (status !== 'cleared') {
        return;
      }
      dealGrid(gridIndex + 1);
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
