import { create } from 'zustand';
import { BET_SPREAD_MAX } from '../engine/betting/betRamp';
import { resolveRound, RoundResolution } from '../engine/blackjack/resolve';
import {
  activeHand,
  applyPlayerAction,
  playDealerTurn,
  RoundEvent,
  RoundState,
  startRound,
} from '../engine/blackjack/round';
import { canDouble, canSplit, PlayerAction } from '../engine/blackjack/rules';
import { Card, hiLoValue } from '../engine/cards/card';
import {
  DAILY_SHOE,
  dailyShoeSeed,
  dayKey,
  buildNumberChoices,
  decksRemainingEstimate,
  expectedBet,
  expectedBetUnits,
  expectedIndexPlay,
  expectedInsurance,
  handUnits,
  HEAT_LIMIT,
  heatAfterBet,
  QuestionKind,
  scoreCalls,
  SHOE_RUN_UNIT_CHIPS,
  ShoeRunCall,
  ShoeRunLevel,
  ShoeRunScore,
  shoeRunStars,
  tableTrueCount,
  trainingLevelSpec,
} from '../engine/dojo';
import { defaultRng, Rng, seededRng } from '../engine/shoe/rng';
import {
  cardsRemaining,
  createShoe,
  EmptyShoeError,
  isShufflePending,
  reshuffleAround,
  Shoe,
} from '../engine/shoe/shoe';
import { useDojoStore, TrainingLevelOutcome } from './dojoStore';
import { useWeakSpotsStore } from './weakSpotsStore';

/**
 * Beat the Shoe — the boss run. One shoe at the casino's table, hand by
 * hand: a count check when one is due, the bet, insurance on an Ace, the
 * plays, the dealer, the result. Every graded call lands in `calls`; the run
 * ends at its hand budget or the cut card, or when the pit boss has seen
 * enough. Nothing here touches the player's chips until the stars are banked.
 */

export type ShoeRunStatus =
  | 'idle'
  | 'question'
  | 'bet'
  | 'insurance'
  | 'play'
  | 'result'
  | 'done';

export interface ShoeRunQuestion {
  readonly kind: QuestionKind;
  readonly correct: number;
  /** Four to pick from, or none when the level types its answers. */
  readonly choices: readonly number[];
}

/** The last call's verdict, for the felt to show over the next step. */
export interface ShoeRunVerdict {
  readonly right: boolean;
  readonly text: string;
  readonly serial: number;
}

export interface ShoeRunState {
  readonly mapId: number;
  readonly level: number;
  readonly spec: ShoeRunLevel | null;
  readonly status: ShoeRunStatus;
  readonly shoe: Shoe | null;
  readonly round: RoundState | null;
  /** Hi-Lo count of every card shown this shoe. */
  readonly runningCount: number;
  /** Hands dealt so far. */
  readonly hands: number;
  /** Units on the current hand, and on the one before (for heat). */
  readonly units: number;
  readonly lastUnits: number;
  readonly heat: number;
  readonly insured: boolean;
  readonly question: ShoeRunQuestion | null;
  readonly calls: readonly ShoeRunCall[];
  readonly verdict: ShoeRunVerdict | null;
  /** The finished hand's results, per hand. */
  readonly resolution: RoundResolution | null;
  /** Running totals in units: the player, and a flat bettor on the same cards. */
  readonly you: number;
  readonly flat: number;
  readonly lastHand: { readonly you: number; readonly flat: number } | null;
  // Run's end
  readonly backedOff: boolean;
  readonly score: ShoeRunScore | null;
  readonly stars: number;
  readonly outcome: TrainingLevelOutcome | null;
  /** Today's shared shoe rather than a casino's boss (`dayKey` names the day). */
  readonly daily: boolean;
  readonly dayKey: string | null;
  /** The daily run's result: edge over the flat bettor, and what it set. */
  readonly dailyResult: { readonly edgeIsBest: boolean; readonly chipsPaid: number } | null;

  readonly load: (mapId: number, level: number) => void;
  /** Point the store at today's daily shoe. */
  readonly loadDaily: (now?: number) => void;
  /** A preview drill off a money bag: a short shoe that banks nothing. */
  readonly loadPractice: (spec: ShoeRunLevel) => void;
  /** True while a preview drill is running. */
  readonly practice: boolean;
  readonly begin: () => void;
  readonly answer: (value: number) => boolean;
  readonly placeBet: (units: number) => void;
  readonly decideInsurance: (take: boolean) => void;
  readonly act: (action: PlayerAction) => void;
  readonly nextHand: () => void;
  readonly canAct: (action: PlayerAction) => boolean;
  readonly reset: () => void;
}

let rng: Rng = defaultRng;
let verdictSerial = 0;

/** Deterministic shoes for tests. Pass nothing to restore the default. */
export function __setShoeRunRngForTests(next?: Rng): void {
  rng = next ?? defaultRng;
}

function countOf(events: readonly RoundEvent[]): number {
  return events.reduce(
    (sum, event) => sum + (event.type === 'cardBecameVisible' ? hiLoValue(event.card.rank) : 0),
    0,
  );
}

function cardsInPlay(round: RoundState): Card[] {
  return [...round.playerHands.flatMap((hand) => hand.cards), ...round.dealerHand.cards];
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

const ACTION_LABEL: Record<PlayerAction, string> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
};

export const useShoeRunStore = create<ShoeRunState>()((set, get) => {
  function idle(mapId: number, level: number) {
    const spec = trainingLevelSpec(mapId, level);
    return {
      mapId,
      level,
      spec: spec.mode === 'shoeRun' ? spec : null,
      status: 'idle' as const,
      shoe: null,
      round: null,
      runningCount: 0,
      hands: 0,
      units: 1,
      lastUnits: 1,
      heat: 0,
      insured: false,
      question: null,
      calls: [],
      verdict: null,
      resolution: null,
      you: 0,
      flat: 0,
      lastHand: null,
      backedOff: false,
      score: null,
      stars: 0,
      outcome: null,
      daily: false,
      dayKey: null,
      dailyResult: null,
      practice: false,
    };
  }

  function idlePractice(spec: ShoeRunLevel) {
    return { ...idle(1, 1), spec, practice: true };
  }

  function idleDaily(now: number) {
    return { ...idle(1, 1), spec: DAILY_SHOE, daily: true, dayKey: dayKey(now) };
  }

  function record(right: boolean, kind: ShoeRunCall['kind'], text: string): void {
    verdictSerial += 1;
    set({ calls: [...get().calls, { kind, right }], verdict: { right, text, serial: verdictSerial } });
  }

  /** Draws against the shoe; a shoe that runs dry mid-hand reshuffles around the table. */
  function withShoe<T>(round: RoundState | null, run: (shoe: Shoe) => T): T {
    const { shoe } = get();
    try {
      return run(shoe!);
    } catch (error) {
      if (!(error instanceof EmptyShoeError) || !round) {
        throw error;
      }
      const fresh = reshuffleAround(shoe!, cardsInPlay(round), rng);
      set({ shoe: fresh, runningCount: 0 });
      return run(fresh);
    }
  }

  function remaining(): number {
    const { shoe } = get();
    return shoe ? cardsRemaining(shoe) : 0;
  }

  /** Between hands: end the run, ask a due check, or open the betting. */
  function toNextHand(): void {
    const { spec, hands, shoe } = get();
    if (!spec || !shoe) {
      return;
    }
    if (hands >= spec.hands || isShufflePending(shoe)) {
      finish(false);
      return;
    }
    set({ round: null, resolution: null, insured: false });
    const due = spec.checks.length > 0 && hands > 0 && hands % spec.checkEvery === 0;
    if (due) {
      const kind = spec.checks[Math.floor(hands / spec.checkEvery - 1) % spec.checks.length];
      const correct = correctFor(kind);
      set({ status: 'question', question: { kind, correct, choices: choicesFor(kind, correct) } });
      return;
    }
    openBetting();
  }

  function choicesFor(kind: QuestionKind, correct: number): number[] {
    const { spec } = get();
    if (!spec || spec.answerInput === 'entry') {
      return [];
    }
    switch (kind) {
      case 'decksRemaining':
        return buildNumberChoices(correct, 0.5, 0.5, spec.deckCount, rng);
      case 'betUnits':
        return buildNumberChoices(correct, 1, 1, BET_SPREAD_MAX, rng);
      default:
        return buildNumberChoices(correct, 1, -40, 40, rng);
    }
  }

  function correctFor(kind: QuestionKind): number {
    const { runningCount } = get();
    switch (kind) {
      case 'runningCount':
        return runningCount;
      case 'decksRemaining':
        return decksRemainingEstimate(remaining());
      case 'trueCount':
        return tableTrueCount(runningCount, remaining());
      case 'betUnits':
        return expectedBetUnits(runningCount, remaining());
    }
  }

  function openBetting(): void {
    const { spec } = get();
    if (!spec) {
      return;
    }
    if (spec.betting) {
      set({ status: 'bet', question: null });
      return;
    }
    deal(1);
  }

  function deal(units: number): void {
    const { spec, lastUnits, heat, hands } = get();
    if (!spec) {
      return;
    }
    const nextHeat = spec.heat && hands > 0 ? heatAfterBet(heat, lastUnits, units) : heat;
    const step = withShoe(null, (shoe) => startRound(units * SHOE_RUN_UNIT_CHIPS, shoe));
    set({
      shoe: step.shoe,
      round: step.round,
      units,
      lastUnits: units,
      heat: nextHeat,
      hands: hands + 1,
      question: null,
      runningCount: get().runningCount + countOf(step.events),
    });
    if (spec.heat && nextHeat >= HEAT_LIMIT) {
      finish(true);
      return;
    }
    const up = step.round.dealerHand.cards[1];
    if (spec.insurance && up.rank === 'A') {
      set({ status: 'insurance' });
      return;
    }
    afterPlayerStep(step.events);
  }

  function afterPlayerStep(events: readonly RoundEvent[]): void {
    if (events.some((event) => event.type === 'playerTurnComplete')) {
      dealerTurn();
      return;
    }
    set({ status: 'play' });
  }

  function dealerTurn(): void {
    const { round, units, insured, you, flat } = get();
    if (!round) {
      return;
    }
    const final = withShoe(round, (shoe) => playDealerTurn(round, shoe));
    const resolution = resolveRound(final.round);
    const hand = handUnits(resolution, units, insured);
    set({
      shoe: final.shoe,
      round: final.round,
      runningCount: get().runningCount + countOf(final.events),
      resolution,
      you: you + hand.you,
      flat: flat + hand.flat,
      lastHand: hand,
      status: 'result',
    });
  }

  function finish(backedOff: boolean): void {
    const { spec, mapId, level, calls, daily, dayKey: day, you, flat, practice } = get();
    if (!spec) {
      return;
    }
    const score = scoreCalls(calls);
    const stars = shoeRunStars(spec, score.accuracy, backedOff);
    if (practice) {
      // A preview drill scores itself and banks nothing.
      set({ status: 'done', backedOff, score, stars, outcome: null });
      return;
    }
    if (daily && day) {
      const dailyResult = useDojoStore.getState().recordDailyShoe(day, you - flat, score.accuracy, backedOff);
      set({ status: 'done', backedOff, score, stars, outcome: null, dailyResult });
      return;
    }
    const outcome = stars > 0 ? useDojoStore.getState().completeTrainingLevel(mapId, level, stars) : null;
    if (stars > 0) {
      useDojoStore.getState().touchPractice();
    }
    useDojoStore.getState().recordTrainingBest(mapId, level, Math.round(score.accuracy * 100), 0);
    set({ status: 'done', backedOff, score, stars, outcome });
  }

  return {
    ...idle(1, 1),

    load: (mapId, level) => set(idle(mapId, level)),

    loadDaily: (now = Date.now()) => set(idleDaily(now)),

    loadPractice: (spec) => set(idlePractice(spec)),

    begin: () => {
      const { mapId, level, daily, dayKey: day, practice, spec: current } = get();
      const base =
        practice && current
          ? idlePractice(current)
          : daily && day
            ? { ...idleDaily(Date.now()), dayKey: day }
            : idle(mapId, level);
      if (!base.spec) {
        return;
      }
      // The daily shoe deals the same shuffle all day, every attempt.
      const shuffle = daily && day ? seededRng(dailyShoeSeed(day)) : rng;
      set({ ...base, shoe: createShoe(base.spec.deckCount, shuffle) });
      toNextHand();
    },

    answer: (value) => {
      const { status, question } = get();
      if (status !== 'question' || !question) {
        return false;
      }
      const right = value === question.correct;
      record(right, 'count', right ? 'Count right' : `Count was ${formatSigned(question.correct)}`);
      openBetting();
      return right;
    },

    placeBet: (requested) => {
      const { status, runningCount, spec, lastUnits, hands } = get();
      if (status !== 'bet' || !spec) {
        return;
      }
      const units = Math.max(1, Math.min(BET_SPREAD_MAX, Math.round(requested)));
      const ramp = expectedBetUnits(runningCount, remaining());
      const expected = expectedBet(runningCount, remaining(), hands > 0 ? lastUnits : BET_SPREAD_MAX, spec.heat);
      const right = units === expected;
      const plural = (count: number) => `${count} unit${count === 1 ? '' : 's'}`;
      record(
        right,
        'bet',
        right
          ? `Bet right — ${plural(units)}`
          : expected < ramp
            ? `Count says ${plural(ramp)} — climb to ${plural(expected)} first`
            : `The count said ${plural(expected)}`,
      );
      deal(units);
    },

    decideInsurance: (take) => {
      const { status, round, runningCount } = get();
      if (status !== 'insurance' || !round) {
        return;
      }
      const expected = expectedInsurance(runningCount, remaining());
      const right = take === expected;
      record(
        right,
        'insurance',
        right ? (take ? 'Insured — the count is high' : 'No insurance — right') : expected ? 'Take it at +3' : 'Only insure at +3 or higher',
      );
      set({ insured: take });
      const natural = round.activeHandIndex === null;
      if (natural) {
        dealerTurn();
      } else {
        set({ status: 'play' });
      }
    },

    canAct: (action) => {
      const { status, round } = get();
      if (status !== 'play' || !round) {
        return false;
      }
      const hand = activeHand(round);
      if (!hand) {
        return false;
      }
      if (action === 'double') {
        return canDouble(hand);
      }
      if (action === 'split') {
        return canSplit(hand, round.splitUsed);
      }
      return true;
    },

    act: (action) => {
      const { status, round, spec, runningCount } = get();
      if (status !== 'play' || !round || !spec || !get().canAct(action)) {
        return;
      }
      const hand = activeHand(round)!;
      if (spec.indexPlays && hand.cards.length === 2 && round.playerHands.length === 1) {
        const expected = expectedIndexPlay(
          hand.cards,
          round.dealerHand.cards[1].rank,
          runningCount,
          remaining(),
          { canDouble: canDouble(hand), canSplit: canSplit(hand, round.splitUsed) },
        );
        if (expected) {
          const right = action === expected;
          record(right, 'play', right ? `Index play — ${ACTION_LABEL[action]}` : `Index play: ${ACTION_LABEL[expected]} here`);
          if (!right) {
            // The slip goes to Weak Spots with the count it turned on, to drill later.
            const availability = { canDouble: canDouble(hand), canSplit: canSplit(hand, round.splitUsed) };
            useWeakSpotsStore.getState().record({
              cards: hand.cards,
              dealerUpRank: round.dealerHand.cards[1].rank,
              ...availability,
              chosen: action,
              book: expected,
              reasonCode: 'INDEX_PLAY',
              trueCount: tableTrueCount(runningCount, remaining()),
            });
          }
        }
      }
      const step = withShoe(round, (shoe) => applyPlayerAction(round, shoe, action));
      set({ shoe: step.shoe, round: step.round, runningCount: get().runningCount + countOf(step.events) });
      afterPlayerStep(step.events);
    },

    nextHand: () => {
      if (get().status !== 'result') {
        return;
      }
      toNextHand();
    },

    reset: () => {
      const { mapId, level, daily, dayKey: day, practice, spec: current } = get();
      if (practice && current) {
        set(idlePractice(current));
        return;
      }
      set(daily && day ? { ...idleDaily(Date.now()), dayKey: day } : idle(mapId, level));
    },
  };
});
