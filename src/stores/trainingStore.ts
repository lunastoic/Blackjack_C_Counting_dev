import { create } from 'zustand';
import { Card } from '../engine/cards/card';
import {
  buildNumberChoices,
  buildTrainingScript,
  canStillPass,
  CheckpointTally,
  DeckEstimateItem,
  drawCardGroupItem,
  drawCardValueItem,
  EMPTY_TALLY,
  groupSizeForStreak,
  hasPassed,
  isCheckpointLevel,
  isStreakLevel,
  makeDeckEstimateItem,
  makeTrueCountItem,
  METER_TOP_UP,
  meterDrainMs,
  practiceShoe,
  QuestionKind,
  QuestionPart,
  recordCheckpoint,
  speedProfile,
  SpeedProfile,
  starsForCheckpointRun,
  starsForStreakRun,
  StreamFrame,
  totalCheckpoints,
  trainingLevelSpec,
  TrainingLevelSpec,
  TrainingScript,
  TrueCountItem,
} from '../engine/dojo';
import { defaultRng, Rng } from '../engine/shoe/rng';
import { Shoe } from '../engine/shoe/shoe';
import { useDojoStore, TrainingLevelOutcome } from './dojoStore';

/**
 * Count training session — one level at one casino. Not persisted: leaving
 * the table forfeits the run, exactly like standing up mid-shoe.
 *
 * Streak drills (card values, groups, deck estimates, true count). A right
 * answer deals the next item at once — the trainee sets the pace, nothing
 * throttles correct answers per minute. Only a miss pauses, to show the fix:
 *
 *   idle ──begin──▶ asking ──correct──▶ asking … ──▶ levelComplete
 *                     │  ▲
 *                     └──miss──▶ feedback ──(auto)──┘
 *
 * Checkpoint drills (count streams, live tables):
 *
 *   idle ──begin──▶ running ──(checkpoint frame)──▶ asking ──answer──▶ feedback
 *                     ▲                                                  │
 *                     └────── resume (correct, or Continue after a miss) ◀┘
 *                                                   │
 *                              levelComplete ◀──────┴──────▶ failed
 *
 * The only clock is the answer meter: full at Start, it drains while a
 * question is open (never while cards deal or a correction shows), every
 * right answer tops it up, and running dry fails the run.
 */
export type TrainingStatus = 'idle' | 'running' | 'asking' | 'feedback' | 'levelComplete' | 'failed';

/** What a streak drill is showing right now. */
export type StreakItem =
  | { readonly kind: 'cards'; readonly cards: readonly Card[]; readonly correct: number }
  | { readonly kind: 'deckEstimate'; readonly item: DeckEstimateItem }
  | { readonly kind: 'trueCount'; readonly item: TrueCountItem };

export interface TrainingQuestion {
  readonly kind: QuestionKind;
  readonly correct: number;
  /** Empty when the level uses exact entry. */
  readonly choices: readonly number[];
  readonly selected: number | null;
  readonly wasCorrect: boolean | null;
  /** The "final count" question after the last card. */
  readonly isFinal: boolean;
  /** Position inside a multi-part checkpoint (decks remaining → true count). */
  readonly partIndex: number;
  readonly partCount: number;
  /** Parts already answered at this checkpoint, shown as givens. */
  readonly givens: readonly QuestionPart[];
}

/** The answer meter, sampled: the UI extrapolates the drain from here. */
export interface MeterState {
  /** Fill from empty (0) to full (1) at `at`. */
  readonly fill: number;
  /** When `fill` was sampled (`Date.now()`). */
  readonly at: number;
  /** Draining toward empty — only while a question is open. */
  readonly draining: boolean;
}

export interface TrainingState {
  readonly mapId: number;
  readonly level: number;
  readonly spec: TrainingLevelSpec;
  readonly speed: SpeedProfile;
  readonly status: TrainingStatus;

  // Streak drills
  readonly streak: number;
  /** Misses so far (each one restarts the streak). */
  readonly resets: number;
  readonly item: StreakItem | null;
  /** Bumps with every new item so the stage can re-animate. */
  readonly itemSerial: number;

  // Checkpoint drills
  readonly script: TrainingScript | null;
  readonly frameIndex: number;
  readonly frame: StreamFrame | null;
  /** Index of the next checkpoint to reach. */
  readonly checkpointIndex: number;
  readonly tally: CheckpointTally;
  /** Cards shown since the last check — the review after a miss. */
  readonly cardsSinceCheck: readonly Card[];
  /** Running count at the last check (where the review starts). */
  readonly countAtLastCheck: number;

  readonly question: TrainingQuestion | null;
  readonly outcome: TrainingLevelOutcome | null;
  /** Stars this run earned (set on completion). */
  readonly stars: number;
  /** First-ever correct check: pause for the "count keeps going" tip. */
  readonly countTipPending: boolean;

  readonly meter: MeterState;
  /** Full-to-empty time for this level (ms). */
  readonly meterDrainMs: number;
  /** The run failed because the meter ran dry, not on misses. */
  readonly timedOut: boolean;

  /** Point the felt at a level. Clears any run in progress. */
  readonly load: (mapId: number, level: number) => void;
  /** Begin / restart the level from scratch with fresh cards. */
  readonly begin: () => void;
  /** Answer the current question. Returns whether it was right. No-op outside `asking`. */
  readonly answer: (value: number) => boolean;
  /** After a miss on a checkpoint drill that can still pass: resume the deal. */
  readonly continueAfterMiss: () => void;
  /** Dismiss the one-time tip and resume. */
  readonly acknowledgeCountTip: () => void;
  /** Back to the level brief. */
  readonly reset: () => void;
}

type Timer = ReturnType<typeof setTimeout>;

const timers = new Set<Timer>();
/** The meter's own timer — cancelled on its own whenever a question closes. */
let meterTimer: Timer | null = null;
let rng: Rng = defaultRng;
let random: Rng = Math.random;

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

function cancelMeterTimer(): void {
  if (meterTimer) {
    clearTimeout(meterTimer);
    timers.delete(meterTimer);
    meterTimer = null;
  }
}

/** Where the meter stands now, extrapolating the drain since it was sampled. */
export function meterFillAt(meter: MeterState, drainMs: number, now: number): number {
  if (!meter.draining) {
    return meter.fill;
  }
  return Math.max(0, meter.fill - (now - meter.at) / drainMs);
}

/** Deterministic dealing for tests. Pass nothing to restore the defaults. */
export function __setTrainingRandomForTests(nextRng?: Rng, nextRandom?: Rng): void {
  rng = nextRng ?? defaultRng;
  random = nextRandom ?? Math.random;
}

/** Answer ranges for four-button checks. */
const RUNNING_COUNT_BOUND = 40;
const TRUE_COUNT_BOUND = 20;

/** Cards to keep in the post-miss review — the last stretch, not a whole shoe. */
const REVIEW_CARD_LIMIT = 14;

/** Beat before the first card lands after Start. */
const OPENING_DELAY_MS = 500;

/** How long a frame stays before the next one, from the speed preset. */
function delayAfter(frame: StreamFrame, spec: TrainingLevelSpec, speed: SpeedProfile): number {
  if (spec.mode === 'countStream') {
    return speed.cardMs;
  }
  switch (frame.beat) {
    case 'card':
      return speed.table.card;
    case 'hit':
    case 'split':
      return speed.table.hit;
    case 'holeFlip':
      return speed.table.holeFlip;
    case 'settle':
    case 'collect':
      return speed.table.collect;
  }
}

function choicesFor(part: QuestionPart, spec: TrainingLevelSpec): number[] {
  if (isCheckpointLevel(spec) && spec.answerInput === 'entry') {
    return [];
  }
  switch (part.kind) {
    case 'runningCount':
      return buildNumberChoices(part.correct, 1, -RUNNING_COUNT_BOUND, RUNNING_COUNT_BOUND, random);
    case 'decksRemaining': {
      const max = isCheckpointLevel(spec) ? spec.deckCount : 8;
      return buildNumberChoices(part.correct, 0.5, 0.5, max, random);
    }
    case 'trueCount':
      return buildNumberChoices(part.correct, 0.5, -TRUE_COUNT_BOUND, TRUE_COUNT_BOUND, random);
  }
}

export const useTrainingStore = create<TrainingState>()((set, get) => {
  let practice: Shoe = practiceShoe(rng);
  /** Per-part results at the checkpoint in progress. */
  let partResults: boolean[] = [];

  function idleState(mapId: number, level: number) {
    const spec = trainingLevelSpec(mapId, level);
    return {
      mapId,
      level,
      spec,
      speed: speedProfile(spec.speed),
      status: 'idle' as const,
      streak: 0,
      resets: 0,
      item: null,
      itemSerial: 0,
      script: null,
      frameIndex: -1,
      frame: null,
      checkpointIndex: 0,
      tally: EMPTY_TALLY,
      cardsSinceCheck: [] as Card[],
      countAtLastCheck: 0,
      question: null,
      outcome: null,
      stars: 0,
      countTipPending: false,
      meter: { fill: 1, at: Date.now(), draining: false },
      meterDrainMs: meterDrainMs(mapId, spec),
      timedOut: false,
    };
  }

  // -------------------------------------------------------------------------
  // Answer meter
  // -------------------------------------------------------------------------

  /** A question just opened: drain from wherever the meter stands. */
  function drainMeter(): void {
    const { meter, meterDrainMs: drainMs } = get();
    cancelMeterTimer();
    const now = Date.now();
    const fill = meterFillAt(meter, drainMs, now);
    set({ meter: { fill, at: now, draining: true } });
    meterTimer = schedule(meterEmpty, fill * drainMs);
  }

  /** The question closed: freeze the meter where it is. */
  function holdMeter(): void {
    const { meter, meterDrainMs: drainMs } = get();
    cancelMeterTimer();
    const now = Date.now();
    set({ meter: { fill: meterFillAt(meter, drainMs, now), at: now, draining: false } });
  }

  /** A right answer tops the (held) meter up, never past full. */
  function feedMeter(): void {
    const { meter } = get();
    set({ meter: { ...meter, fill: Math.min(1, meter.fill + METER_TOP_UP) } });
  }

  /** The meter ran dry: the run is over. */
  function meterEmpty(): void {
    clearAllTimers();
    set({ status: 'failed', timedOut: true, meter: { fill: 0, at: Date.now(), draining: false } });
  }

  // -------------------------------------------------------------------------
  // Streak drills
  // -------------------------------------------------------------------------

  function nextStreakItem(): void {
    const { spec, streak, itemSerial } = get();
    let item: StreakItem;
    switch (spec.mode) {
      case 'cardValue': {
        const result = drawCardValueItem(practice, rng);
        practice = result.shoe;
        item = { kind: 'cards', ...result.item };
        break;
      }
      case 'cardGroup': {
        const size = groupSizeForStreak(spec, streak, random);
        const result = drawCardGroupItem(practice, size, spec.emphasizeCancellation, rng);
        practice = result.shoe;
        item = { kind: 'cards', ...result.item };
        break;
      }
      case 'deckEstimate':
        item = { kind: 'deckEstimate', item: makeDeckEstimateItem(spec, random) };
        break;
      case 'trueCount':
        item = { kind: 'trueCount', item: makeTrueCountItem(spec, random) };
        break;
      default:
        return;
    }
    set({ status: 'asking', item, itemSerial: itemSerial + 1, question: null });
    drainMeter();
  }

  function streakCorrect(item: StreakItem): number {
    return item.kind === 'cards' ? item.correct : item.item.correct;
  }

  function completeLevel(stars: number): void {
    const { mapId, level } = get();
    const dojo = useDojoStore.getState();
    const outcome = dojo.completeTrainingLevel(mapId, level, stars);
    dojo.touchPractice();
    set({ status: 'levelComplete', outcome, stars });
  }

  function answerStreak(value: number): boolean {
    const state = get();
    if (!state.item || !isStreakLevel(state.spec)) {
      return false;
    }
    const correct = streakCorrect(state.item);
    const wasCorrect = value === correct;
    holdMeter();
    if (wasCorrect) {
      feedMeter();
    }
    const question: TrainingQuestion = {
      kind: 'runningCount',
      correct,
      choices: [],
      selected: value,
      wasCorrect,
      isFinal: false,
      partIndex: 0,
      partCount: 1,
      givens: [],
    };

    if (wasCorrect) {
      const streak = state.streak + 1;
      if (streak >= state.spec.streakTarget) {
        set({ question, streak });
        completeLevel(starsForStreakRun(state.resets));
        return true;
      }
      // No feedback beat on a right answer: the next item lands immediately so
      // the pad is live again the moment the trainee taps.
      set({ streak });
      nextStreakItem();
      return true;
    }

    set({ question, streak: 0, resets: state.resets + 1, status: 'feedback' });
    schedule(nextStreakItem, state.speed.missMs);
    return false;
  }

  // -------------------------------------------------------------------------
  // Checkpoint drills
  // -------------------------------------------------------------------------

  function playFrame(index: number): void {
    const { script, spec, speed, checkpointIndex, cardsSinceCheck } = get();
    if (!script) {
      return;
    }
    const frame = script.frames[index];
    const shown = frame.card
      ? [...cardsSinceCheck, frame.card].slice(-REVIEW_CARD_LIMIT)
      : cardsSinceCheck;
    set({ status: 'running', frameIndex: index, frame, cardsSinceCheck: shown, question: null });

    const wait = delayAfter(frame, spec, speed);
    const checkpoint = script.checkpoints[checkpointIndex];
    if (checkpoint && checkpoint.frameIndex === index) {
      schedule(() => askPart(0, []), wait);
      return;
    }
    schedule(playNext, wait);
  }

  function playNext(): void {
    const { script, frameIndex } = get();
    if (!script) {
      return;
    }
    const next = frameIndex + 1;
    if (next >= script.frames.length) {
      finishScript();
      return;
    }
    playFrame(next);
  }

  /** Deal ran out before the last check (only a truncated script does this). */
  function finishScript(): void {
    const { spec, tally } = get();
    if (!isCheckpointLevel(spec)) {
      return;
    }
    if (hasPassed(spec.pass, tally)) {
      completeLevel(starsForCheckpointRun(tally.asked - tally.correct));
    } else {
      set({ status: 'failed' });
    }
  }

  function askPart(partIndex: number, givens: readonly QuestionPart[]): void {
    const { script, checkpointIndex, spec } = get();
    if (!script) {
      return;
    }
    const checkpoint = script.checkpoints[checkpointIndex];
    const part = checkpoint.parts[partIndex];
    if (partIndex === 0) {
      partResults = [];
    }
    set({
      status: 'asking',
      question: {
        kind: part.kind,
        correct: part.correct,
        choices: choicesFor(part, spec),
        selected: null,
        wasCorrect: null,
        isFinal: checkpoint.isFinal,
        partIndex,
        partCount: checkpoint.parts.length,
        givens,
      },
    });
    drainMeter();
  }

  function resumeAfterCheck(): void {
    const { frame } = get();
    set({
      checkpointIndex: get().checkpointIndex + 1,
      cardsSinceCheck: [],
      countAtLastCheck: frame?.runningCount ?? 0,
    });
    playNext();
  }

  function answerCheckpoint(value: number): boolean {
    const state = get();
    const { script, question, spec } = state;
    if (!script || !question || !isCheckpointLevel(spec)) {
      return false;
    }
    const checkpoint = script.checkpoints[state.checkpointIndex];
    const wasCorrect = value === question.correct;
    holdMeter();
    if (wasCorrect) {
      feedMeter();
    }
    partResults = [...partResults, wasCorrect];
    const answered = { ...question, selected: value, wasCorrect };

    // More parts to go at this pause: carry the answered part as a given.
    if (wasCorrect && question.partIndex + 1 < checkpoint.parts.length) {
      set({ question: answered });
      askPart(question.partIndex + 1, [
        ...question.givens,
        { kind: question.kind, correct: question.correct },
      ]);
      return true;
    }

    const askedParts = checkpoint.parts.slice(0, partResults.length);
    const tally = recordCheckpoint(state.tally, askedParts, partResults);
    const isLast = state.checkpointIndex + 1 >= script.checkpoints.length;
    set({ question: answered, tally });

    if (isLast) {
      if (hasPassed(spec.pass, tally)) {
        completeLevel(starsForCheckpointRun(tally.asked - tally.correct));
      } else {
        set({ status: 'failed' });
      }
      return wasCorrect;
    }

    if (wasCorrect) {
      // First correct check ever: hold for the "count keeps going" tip.
      if (!useDojoStore.getState().flashCountTipSeen) {
        set({ status: 'feedback', countTipPending: true });
        return true;
      }
      set({ status: 'feedback' });
      schedule(resumeAfterCheck, state.speed.feedbackMs);
      return true;
    }

    set({ status: canStillPass(spec.pass, tally, totalCheckpoints(spec)) ? 'feedback' : 'failed' });
    return false;
  }

  function beginScript(): void {
    const { spec } = get();
    if (!isCheckpointLevel(spec)) {
      return;
    }
    const script = buildTrainingScript(spec, rng, random);
    set({ script, status: 'running' });
    schedule(() => playFrame(0), OPENING_DELAY_MS);
  }

  return {
    ...idleState(1, 1),

    load: (mapId, level) => {
      clearAllTimers();
      set(idleState(mapId, level));
    },

    begin: () => {
      clearAllTimers();
      const { mapId, level } = get();
      set(idleState(mapId, level));
      partResults = [];
      if (isCheckpointLevel(get().spec)) {
        beginScript();
      } else {
        practice = practiceShoe(rng);
        nextStreakItem();
      }
    },

    answer: (value) => {
      const state = get();
      if (state.status !== 'asking') {
        return false;
      }
      return isCheckpointLevel(state.spec) ? answerCheckpoint(value) : answerStreak(value);
    },

    continueAfterMiss: () => {
      const { status, question } = get();
      if (status !== 'feedback' || question?.wasCorrect !== false) {
        return;
      }
      resumeAfterCheck();
    },

    acknowledgeCountTip: () => {
      if (!get().countTipPending) {
        return;
      }
      useDojoStore.getState().markFlashCountTipSeen();
      set({ countTipPending: false });
      resumeAfterCheck();
    },

    reset: () => {
      clearAllTimers();
      const { mapId, level } = get();
      set(idleState(mapId, level));
    },
  };
});
