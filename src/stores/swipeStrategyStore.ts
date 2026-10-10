import { create } from 'zustand';
import {
  isClearingStars,
  makeStrategyItem,
  meterDrainMs,
  STAR_COUNT,
  starsReached,
  StarTargets,
  starTargets,
  StrategyItem,
  SWIPE_DECISION,
  SwipeDirection,
  SwipeStrategyLevel,
  trainingLevelSpec,
} from '../engine/dojo';
import { defaultRng, Rng } from '../engine/shoe/rng';
import { useDailyGoalStore } from './dailyGoalStore';
import { TrainingLevelOutcome, useDojoStore } from './dojoStore';
import { MeterState, meterFillAt, StarBank } from './trainingStore';

/**
 * Swipe Strategy — Io Inferno's level 2, one wave of hands at a time:
 *
 *   idle ──begin──▶ playing ──right──▶ playing … (wave done: a star)
 *                     │  ▲
 *                     └──wrong──▶ feedback ──(beat)──┘
 *
 * A star per wave; the second clears the level and pauses the run
 * (`cleared` → keepGoing / stopRun), the third ends it. A wrong swipe costs a
 * strike and shows the book play; one more miss than the level's strikes
 * ends the run. The meter drains while a hand is up; every right swipe tops
 * it up. Fast right swipes build a combo.
 */
export type SwipeStrategyStatus = 'idle' | 'playing' | 'feedback' | 'cleared' | 'levelComplete' | 'failed';

/** The last swipe, for the felt to call out. */
export interface SwipeAnswer {
  readonly code: number;
  readonly wasCorrect: boolean;
  /** The book play. */
  readonly correct: number;
}

/** Each right swipe tops the meter up this much. */
export const SWIPE_TOP_UP = 0.25;
/** A wrong swipe shows its fix this long before the next hand (ms). */
export const SWIPE_MISS_MS = 1400;

export interface SwipeStrategyState {
  readonly mapId: number;
  readonly level: number;
  readonly spec: SwipeStrategyLevel | null;
  readonly status: SwipeStrategyStatus;
  readonly item: StrategyItem | null;
  /** Bumps with every new hand so the felt can deal it in. */
  readonly itemSerial: number;
  /** 0-based wave in play. */
  readonly wave: number;
  /** Right swipes in the wave in play. */
  readonly handsInWave: number;
  readonly wavesDone: number;
  readonly rightAnswers: number;
  readonly misses: number;
  readonly lastAnswer: SwipeAnswer | null;
  readonly combo: number;
  readonly comboBest: number;
  readonly stars: number;
  readonly targets: StarTargets;
  readonly starBank: StarBank | null;
  readonly outcome: TrainingLevelOutcome | null;
  readonly meter: MeterState;
  readonly meterDrainMs: number;
  readonly timedOut: boolean;

  readonly load: (mapId: number, level: number) => void;
  readonly begin: () => void;
  /** Swipe the hand. Returns whether it was the book play. */
  readonly swipe: (direction: SwipeDirection) => boolean;
  /** Answer by DECISION code (the fallback buttons). */
  readonly answer: (code: number) => boolean;
  readonly keepGoing: () => void;
  readonly stopRun: () => void;
  readonly reset: () => void;
}

type Timer = ReturnType<typeof setTimeout>;
const timers = new Set<Timer>();
let meterTimer: Timer | null = null;
let rng: Rng = defaultRng;
let bankSerial = 0;

/** Deterministic hands for tests. Pass nothing to restore the default. */
export function __setSwipeStrategyRngForTests(next?: Rng): void {
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

function specFor(mapId: number, level: number): SwipeStrategyLevel | null {
  try {
    const spec = trainingLevelSpec(mapId, level);
    return spec.mode === 'swipeStrategy' ? spec : null;
  } catch {
    return null;
  }
}

export const useSwipeStrategyStore = create<SwipeStrategyState>()((set, get) => {
  let runSettled = false;
  /** When the hand in play was dealt (null between hands). */
  let dealtAt: number | null = null;

  function idle(mapId: number, level: number) {
    const spec = specFor(mapId, level);
    runSettled = false;
    dealtAt = null;
    return {
      mapId,
      level,
      spec,
      status: 'idle' as const,
      item: null,
      itemSerial: 0,
      wave: 0,
      handsInWave: 0,
      wavesDone: 0,
      rightAnswers: 0,
      misses: 0,
      lastAnswer: null,
      combo: 0,
      comboBest: 0,
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
    const { mapId, level, rightAnswers, comboBest } = get();
    useDojoStore.getState().recordTrainingBest(mapId, level, rightAnswers, comboBest);
  }

  function endRun(): void {
    clearAllTimers();
    dealtAt = null;
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

  function deal(): void {
    const { spec, itemSerial } = get();
    if (!spec) {
      return;
    }
    set({
      status: 'playing',
      item: makeStrategyItem(['hard', 'soft', 'pairs'], spec.deckCount, rng),
      itemSerial: itemSerial + 1,
    });
    dealtAt = Date.now();
    drain();
  }

  /** A wave is in: bank its star, then the next wave, the clear pause, or the end. */
  function waveDone(): void {
    const { wavesDone, targets, stars, spec, wave } = get();
    const done = wavesDone + 1;
    set({ wavesDone: done, handsInWave: 0 });
    const reached = starsReached(targets, done);
    if (reached > stars) {
      bankStars(reached);
    }
    if (reached >= STAR_COUNT || !spec || wave + 1 >= spec.waves) {
      endRun();
      return;
    }
    set({ wave: wave + 1 });
    if (isClearingStars(reached) && !isClearingStars(stars)) {
      clearAllTimers();
      dealtAt = null;
      set({ status: 'cleared' });
      return;
    }
    deal();
  }

  function answer(code: number): boolean {
    const { status, item, spec, meterDrainMs: drainMs } = get();
    if (status !== 'playing' || !item || !spec) {
      return false;
    }
    const openFor = dealtAt !== null ? Date.now() - dealtAt : Number.POSITIVE_INFINITY;
    dealtAt = null;
    hold();
    const wasCorrect = code === item.correct;
    set({ lastAnswer: { code, wasCorrect, correct: item.correct } });

    if (wasCorrect) {
      feed(SWIPE_TOP_UP);
      useDailyGoalStore.getState().noteTrainingAnswer();
      const fast = openFor <= drainMs * SWIPE_TOP_UP;
      const { combo, comboBest, rightAnswers, handsInWave } = get();
      const nextCombo = fast ? combo + 1 : combo;
      set({
        combo: nextCombo,
        comboBest: Math.max(comboBest, nextCombo),
        rightAnswers: rightAnswers + 1,
        handsInWave: handsInWave + 1,
      });
      if (handsInWave + 1 >= spec.handsPerWave) {
        waveDone();
      } else {
        deal();
      }
      return true;
    }

    const misses = get().misses + 1;
    set({ misses, combo: 0 });
    if (misses > spec.strikes) {
      endRun();
      return false;
    }
    set({ status: 'feedback' });
    schedule(deal, SWIPE_MISS_MS);
    return false;
  }

  return {
    ...idle(2, 2),

    load: (mapId, level) => {
      clearAllTimers();
      set(idle(mapId, level));
    },

    begin: () => {
      clearAllTimers();
      const { mapId, level } = get();
      set(idle(mapId, level));
      deal();
    },

    swipe: (direction) => answer(SWIPE_DECISION[direction]),

    answer,

    keepGoing: () => {
      if (get().status !== 'cleared') {
        return;
      }
      deal();
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
