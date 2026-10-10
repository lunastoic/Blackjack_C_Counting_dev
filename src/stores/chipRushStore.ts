import { create } from 'zustand';
import {
  CHIP_RUSH_SPAWN_SHARE,
  ChipRushLevel,
  chipRushBet,
  chipRushCrossMs,
  chipRushTrueCount,
  isClearingStars,
  STAR_COUNT,
  starsReached,
  StarTargets,
  starTargets,
  trainingLevelSpec,
} from '../engine/dojo';
import { defaultRng, Rng } from '../engine/shoe/rng';
import { useDailyGoalStore } from './dailyGoalStore';
import { TrainingLevelOutcome, useDojoStore } from './dojoStore';
import { StarBank } from './trainingStore';

/**
 * Chip Rush — Ganymede's level 2. True-count cards slide along a lane toward
 * a red edge; the player bets on the FRONT card (the one nearest the edge):
 *
 *   idle ──begin──▶ playing ──(wave resolved)──▶ feedback ──▶ playing (next wave)
 *                     │                └──(second star)──▶ cleared ──keepGoing / stopRun
 *                     └── strikes past the limit ──▶ failed / levelComplete
 *
 * A right bet clears the card and grows the combo. A wrong bet is a strike
 * (the card stays); a card reaching the edge is a strike and leaves the lane.
 * Each wave deals `cardsPerWave` cards; resolving them all banks a star.
 * The lane is the clock: each wave's cards cross faster than the last.
 */
export type ChipRushStatus = 'idle' | 'playing' | 'feedback' | 'cleared' | 'levelComplete' | 'failed';

export interface LaneCard {
  readonly id: number;
  readonly trueCount: number;
  /** When it entered the lane (`Date.now()`). */
  readonly spawnAt: number;
  /** Time it takes to reach the edge (ms). */
  readonly crossMs: number;
}

export interface ChipRushMiss {
  readonly reason: 'wrong' | 'escape';
  /** The card the miss was on. */
  readonly trueCount: number;
  /** The bet it asked for. */
  readonly correct: number;
  readonly serial: number;
}

/** A beat between one wave and the next (ms). */
const NEXT_WAVE_MS = 900;

export interface ChipRushState {
  readonly mapId: number;
  readonly level: number;
  readonly spec: ChipRushLevel | null;
  readonly status: ChipRushStatus;
  /** 0-based wave on the lane. */
  readonly wave: number;
  /** Cards dealt so far this wave. */
  readonly dealt: number;
  /** Cards resolved (bet right, or escaped) this wave. */
  readonly resolved: number;
  readonly cards: readonly LaneCard[];
  readonly wavesDone: number;
  readonly misses: number;
  readonly lastMiss: ChipRushMiss | null;
  /** Bumps on every right bet so the felt can pop the card. */
  readonly clearSerial: number;
  readonly combo: number;
  readonly comboBest: number;
  readonly stars: number;
  readonly targets: StarTargets;
  readonly starBank: StarBank | null;
  readonly outcome: TrainingLevelOutcome | null;

  readonly load: (mapId: number, level: number) => void;
  readonly begin: () => void;
  /** Bet `units` on the front card. Returns whether it was right. */
  readonly bet: (units: number) => boolean;
  readonly keepGoing: () => void;
  readonly stopRun: () => void;
  readonly reset: () => void;
}

type Timer = ReturnType<typeof setTimeout>;
const timers = new Set<Timer>();
/** Each card's escape timer, by card id. */
const escapeTimers = new Map<number, Timer>();
let rng: Rng = defaultRng;
let cardSerial = 0;
let missSerial = 0;
let bankSerial = 0;

/** Deterministic counts for tests. Pass nothing to restore the default. */
export function __setChipRushRngForTests(next?: Rng): void {
  rng = next ?? defaultRng;
}

function clearAllTimers(): void {
  for (const timer of timers) {
    clearTimeout(timer);
  }
  timers.clear();
  escapeTimers.clear();
}

function schedule(fn: () => void, delay: number): Timer {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, delay);
  timers.add(timer);
  return timer;
}

function cancel(timer: Timer | undefined): void {
  if (timer) {
    clearTimeout(timer);
    timers.delete(timer);
  }
}

function specFor(mapId: number, level: number): ChipRushLevel | null {
  try {
    const spec = trainingLevelSpec(mapId, level);
    return spec.mode === 'chipRush' ? spec : null;
  } catch {
    return null;
  }
}

/** The card nearest the edge — the one a bet lands on. */
export function frontCard(cards: readonly LaneCard[]): LaneCard | null {
  return cards.reduce<LaneCard | null>(
    (front, card) =>
      front === null || card.spawnAt + card.crossMs < front.spawnAt + front.crossMs ? card : front,
    null,
  );
}

export const useChipRushStore = create<ChipRushState>()((set, get) => {
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
      wave: 0,
      dealt: 0,
      resolved: 0,
      cards: [] as LaneCard[],
      wavesDone: 0,
      misses: 0,
      lastMiss: null,
      clearSerial: 0,
      combo: 0,
      comboBest: 0,
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
    const { mapId, level, wavesDone, comboBest } = get();
    useDojoStore.getState().recordTrainingBest(mapId, level, wavesDone, comboBest);
  }

  function endRun(): void {
    clearAllTimers();
    settleRun();
    set({ status: isClearingStars(get().stars) ? 'levelComplete' : 'failed', cards: [] });
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

  function strike(miss: Omit<ChipRushMiss, 'serial'>): boolean {
    const misses = get().misses + 1;
    missSerial += 1;
    set({ misses, combo: 0, lastMiss: { ...miss, serial: missSerial } });
    if (misses > (get().spec?.strikes ?? 0)) {
      endRun();
      return false;
    }
    return true;
  }

  function spawn(): void {
    const { spec, wave, dealt, cards, status } = get();
    if (!spec || status !== 'playing' || dealt >= spec.cardsPerWave) {
      return;
    }
    const crossMs = chipRushCrossMs(spec, wave);
    cardSerial += 1;
    const card: LaneCard = { id: cardSerial, trueCount: chipRushTrueCount(rng), spawnAt: Date.now(), crossMs };
    set({ cards: [...cards, card], dealt: dealt + 1 });
    escapeTimers.set(card.id, schedule(() => escape(card.id), crossMs));
    if (dealt + 1 < spec.cardsPerWave) {
      schedule(spawn, Math.round(crossMs * CHIP_RUSH_SPAWN_SHARE));
    }
  }

  function escape(id: number): void {
    escapeTimers.delete(id);
    const card = get().cards.find((entry) => entry.id === id);
    if (!card || get().status !== 'playing') {
      return;
    }
    set({ cards: get().cards.filter((entry) => entry.id !== id), resolved: get().resolved + 1 });
    if (strike({ reason: 'escape', trueCount: card.trueCount, correct: chipRushBet(card.trueCount) })) {
      checkWaveEnd();
    }
  }

  function startWave(wave: number): void {
    set({ status: 'playing', wave, dealt: 0, resolved: 0, cards: [] });
    spawn();
  }

  /** Every card of the wave dealt and resolved: bank its star, then the next wave, the pause, or the end. */
  function checkWaveEnd(): void {
    const { spec, dealt, cards, wavesDone, targets, stars, wave } = get();
    if (!spec || dealt < spec.cardsPerWave || cards.length > 0) {
      return;
    }
    const done = wavesDone + 1;
    set({ wavesDone: done });
    useDailyGoalStore.getState().noteTrainingAnswer();
    const reached = starsReached(targets, done);
    if (reached > stars) {
      bankStars(reached);
    }
    if (reached >= STAR_COUNT || wave + 1 >= spec.waves) {
      endRun();
      return;
    }
    if (isClearingStars(reached) && !isClearingStars(stars)) {
      clearAllTimers();
      set({ status: 'cleared' });
      return;
    }
    set({ status: 'feedback' });
    schedule(() => startWave(wave + 1), NEXT_WAVE_MS);
  }

  return {
    ...idle(4, 2),

    load: (mapId, level) => {
      clearAllTimers();
      set(idle(mapId, level));
    },

    begin: () => {
      clearAllTimers();
      const { mapId, level } = get();
      set(idle(mapId, level));
      startWave(0);
    },

    bet: (units) => {
      const { status, cards } = get();
      if (status !== 'playing') {
        return false;
      }
      const front = frontCard(cards);
      if (!front) {
        return false;
      }
      const correct = chipRushBet(front.trueCount);
      if (units === correct) {
        cancel(escapeTimers.get(front.id));
        escapeTimers.delete(front.id);
        const combo = get().combo + 1;
        set({
          cards: cards.filter((card) => card.id !== front.id),
          resolved: get().resolved + 1,
          combo,
          comboBest: Math.max(get().comboBest, combo),
          clearSerial: get().clearSerial + 1,
        });
        checkWaveEnd();
        return true;
      }
      strike({ reason: 'wrong', trueCount: front.trueCount, correct });
      return false;
    },

    keepGoing: () => {
      const { status, wave } = get();
      if (status !== 'cleared') {
        return;
      }
      startWave(wave + 1);
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
