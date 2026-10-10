import { create } from 'zustand';
import {
  FlipPointItem,
  FlipPointLevel,
  isClearingStars,
  isFlipStopRight,
  makeFlipPointItem,
  STAR_COUNT,
  starsReached,
  StarTargets,
  starTargets,
  sweepValueAt,
  trainingLevelSpec,
} from '../engine/dojo';
import { defaultRng, Rng } from '../engine/shoe/rng';
import { useDailyGoalStore } from './dailyGoalStore';
import { TrainingLevelOutcome, useDojoStore } from './dojoStore';
import { StarBank } from './trainingStore';

/**
 * Flip Point — Titan's level 2, one hand at a time:
 *
 *   idle ──begin──▶ sweeping ──stop / sweep runs out──▶ reveal ──(beat)──▶ sweeping …
 *
 * A stop within the tolerance of the play's index is right; a wrong stop or
 * a sweep that reaches +5 costs a strike (one more than the level's strikes
 * ends the run). Every `handsPerSet` right stops make a set and a star; the
 * second star clears the level and pauses the run (`cleared` → keepGoing /
 * stopRun), the third — or the last set — ends it. The sweep is the clock.
 */
export type FlipPointStatus = 'idle' | 'sweeping' | 'reveal' | 'cleared' | 'levelComplete' | 'failed';

/** How long the zones and the flip mark stay up after a stop (ms). */
export const FLIP_REVEAL_MS = 1500;

export interface FlipPointState {
  readonly mapId: number;
  readonly level: number;
  readonly spec: FlipPointLevel | null;
  readonly status: FlipPointStatus;
  readonly item: FlipPointItem | null;
  /** Bumps with every new hand so the slider restarts. */
  readonly itemSerial: number;
  /** When the current sweep started (`Date.now()`), null between sweeps. */
  readonly sweepStartedAt: number | null;
  /** Where the last stop landed; null when the sweep ran out. */
  readonly stopValue: number | null;
  /** The last hand's verdict, for the reveal. */
  readonly lastRight: boolean | null;
  /** Right stops in the set in progress. */
  readonly handsInSet: number;
  readonly setsDone: number;
  readonly rightTotal: number;
  readonly misses: number;
  readonly stars: number;
  readonly targets: StarTargets;
  readonly starBank: StarBank | null;
  readonly outcome: TrainingLevelOutcome | null;

  readonly load: (mapId: number, level: number) => void;
  readonly begin: () => void;
  /** Stop the knob where it is. Returns whether the stop was right. */
  readonly stop: () => boolean;
  readonly keepGoing: () => void;
  readonly stopRun: () => void;
  readonly reset: () => void;
}

type Timer = ReturnType<typeof setTimeout>;
const timers = new Set<Timer>();
let rng: Rng = defaultRng;
let bankSerial = 0;

/** Deterministic hands for tests. Pass nothing to restore the default. */
export function __setFlipPointRngForTests(next?: Rng): void {
  rng = next ?? defaultRng;
}

function clearAllTimers(): void {
  for (const timer of timers) {
    clearTimeout(timer);
  }
  timers.clear();
}

function schedule(fn: () => void, delay: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, delay);
  timers.add(timer);
}

function specFor(mapId: number, level: number): FlipPointLevel | null {
  try {
    const spec = trainingLevelSpec(mapId, level);
    return spec.mode === 'flipPoint' ? spec : null;
  } catch {
    return null;
  }
}

export const useFlipPointStore = create<FlipPointState>()((set, get) => {
  let runSettled = false;
  /** The item a run has already shown last, so a hand never repeats back to back. */
  let previousId: string | undefined;

  function idle(mapId: number, level: number) {
    const spec = specFor(mapId, level);
    runSettled = false;
    previousId = undefined;
    return {
      mapId,
      level,
      spec,
      status: 'idle' as const,
      item: null,
      itemSerial: 0,
      sweepStartedAt: null,
      stopValue: null,
      lastRight: null,
      handsInSet: 0,
      setsDone: 0,
      rightTotal: 0,
      misses: 0,
      stars: 0,
      targets: spec ? starTargets(spec) : ([1, 2, 3] as StarTargets),
      starBank: null,
      outcome: null,
    };
  }

  function settleRun(): void {
    if (runSettled) {
      return;
    }
    runSettled = true;
    const { mapId, level, rightTotal } = get();
    useDojoStore.getState().recordTrainingBest(mapId, level, rightTotal, 0);
  }

  function endRun(): void {
    clearAllTimers();
    settleRun();
    set({
      status: isClearingStars(get().stars) ? 'levelComplete' : 'failed',
      sweepStartedAt: null,
    });
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

  function dealHand(): void {
    const { spec, itemSerial } = get();
    if (!spec) {
      return;
    }
    const item = makeFlipPointItem(spec.plays, rng, previousId);
    previousId = item.play.id;
    set({
      status: 'sweeping',
      item,
      itemSerial: itemSerial + 1,
      sweepStartedAt: Date.now(),
      stopValue: null,
      lastRight: null,
    });
    schedule(sweepRanOut, spec.sweepMs);
  }

  /** The knob reached +5 with no stop: a miss. */
  function sweepRanOut(): void {
    if (get().status !== 'sweeping') {
      return;
    }
    settleHand(false, null);
  }

  /** A hand is decided: count it, show the reveal, then move on. */
  function settleHand(right: boolean, stopValue: number | null): void {
    clearAllTimers();
    const state = get();
    const spec = state.spec;
    if (!spec) {
      return;
    }
    if (right) {
      useDailyGoalStore.getState().noteTrainingAnswer();
      set({
        status: 'reveal',
        stopValue,
        lastRight: true,
        sweepStartedAt: null,
        handsInSet: state.handsInSet + 1,
        rightTotal: state.rightTotal + 1,
      });
      schedule(afterReveal, FLIP_REVEAL_MS);
      return;
    }
    const misses = state.misses + 1;
    set({ status: 'reveal', stopValue, lastRight: false, sweepStartedAt: null, misses });
    if (misses > spec.strikes) {
      // Out of strikes: the reveal still shows why, then the run ends.
      schedule(endRun, FLIP_REVEAL_MS);
      return;
    }
    schedule(afterReveal, FLIP_REVEAL_MS);
  }

  /** After the reveal: bank a finished set, pause at the clear, end, or deal on. */
  function afterReveal(): void {
    const { spec, handsInSet, setsDone, stars, targets } = get();
    if (!spec) {
      return;
    }
    if (handsInSet < spec.handsPerSet) {
      dealHand();
      return;
    }
    const done = setsDone + 1;
    set({ setsDone: done, handsInSet: 0 });
    const reached = starsReached(targets, done);
    if (reached > stars) {
      bankStars(reached);
    }
    if (reached >= STAR_COUNT || done >= spec.sets) {
      endRun();
      return;
    }
    if (isClearingStars(reached) && !isClearingStars(stars)) {
      clearAllTimers();
      set({ status: 'cleared', sweepStartedAt: null });
      return;
    }
    dealHand();
  }

  return {
    ...idle(5, 2),

    load: (mapId, level) => {
      clearAllTimers();
      set(idle(mapId, level));
    },

    begin: () => {
      clearAllTimers();
      const { mapId, level } = get();
      set(idle(mapId, level));
      dealHand();
    },

    stop: () => {
      const { status, spec, item, sweepStartedAt } = get();
      if (status !== 'sweeping' || !spec || !item || sweepStartedAt === null) {
        return false;
      }
      const value = sweepValueAt(Date.now() - sweepStartedAt, spec.sweepMs);
      const right = isFlipStopRight(value, item.play.index, spec.tolerance);
      settleHand(right, value);
      return right;
    },

    keepGoing: () => {
      if (get().status !== 'cleared') {
        return;
      }
      dealHand();
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
