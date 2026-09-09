import { applyPlayerAction, RoundState } from '../blackjack/round';
import { HandResult, resolveHand } from '../blackjack/resolve';
import { canDouble, canSplit, dealerShouldHit, PlayerAction } from '../blackjack/rules';
import { Card, hiLoValue, isFaceUp, withVisibility } from '../cards/card';
import { CARDS_PER_DECK } from '../cards/deck';
import { roundToNearestHalf } from '../counting/trueCount';
import { evaluateCards, isNaturalBlackjack } from '../hand/evaluate';
import { addCard, createDealerHand, createPlayerHand, DealerHand, PlayerHand } from '../hand/hand';
import { defaultRng, fisherYatesShuffle, Rng } from '../shoe/rng';
import { recommendForHand } from '../strategy/recommend';
import {
  cardsRemaining,
  createShoe,
  cutCardDealtCount,
  DeckCount,
  draw,
  EmptyShoeError,
  Shoe,
  totalCards,
} from '../shoe/shoe';
import { FLASH_AUTOPLAY_STAND, FLASH_LEVELS_PER_MAP } from './countFlash';

/**
 * Count training — the six-level ladder every casino makes you climb before
 * its table opens. Each casino teaches one thing (values → speed → deck
 * estimation → true count → live tables → mastery) and every level is a
 * configuration of one of six reusable modes:
 *
 *   cardValue     one card, tap −1 / 0 / +1                (streak)
 *   cardGroup     several cards, tap the net value         (streak)
 *   deckEstimate  read the discard tray, tap decks left    (streak)
 *   trueCount     RC and decks given, tap the true count   (streak)
 *   countStream   cards one at a time, random count checks (checkpoints)
 *   tableCount    autoplayed blackjack, random count checks (checkpoints)
 *
 * There are no countdown timers anywhere in the ladder: difficulty comes from
 * more cards, faster dealing, fewer pauses and bigger shoes. Pure TypeScript —
 * no React / RN imports (see architecture-guard test).
 */

// ---------------------------------------------------------------------------
// Speed presets
// ---------------------------------------------------------------------------

export const SPEED_PRESETS = ['beginner', 'easy', 'normal', 'fast', 'veryFast', 'casino'] as const;
export type SpeedPreset = (typeof SPEED_PRESETS)[number];

export interface SpeedProfile {
  readonly label: string;
  /** A streamed card sits alone on the felt this long before the next (ms). */
  readonly cardMs: number;
  /** A correct checkpoint answer lingers this long before the stream resumes (ms). Streak drills never pause on a right answer. */
  readonly feedbackMs: number;
  /** A miss on a streak drill shows its correction this long (ms). */
  readonly missMs: number;
  /** Card animation speed multiplier (1 = the live table at normal speed). */
  readonly animation: number;
  /** Live-table beats (ms): one dealt card, a hit, the hole flip, clearing the felt. */
  readonly table: {
    readonly card: number;
    readonly hit: number;
    readonly holeFlip: number;
    readonly collect: number;
  };
}

/** `normal` is the live table's own pacing; the rest scale around it. */
export const SPEED_PROFILES: Readonly<Record<SpeedPreset, SpeedProfile>> = {
  beginner: {
    label: 'Beginner',
    cardMs: 1500,
    feedbackMs: 900,
    missMs: 1800,
    animation: 1,
    table: { card: 700, hit: 800, holeFlip: 850, collect: 800 },
  },
  easy: {
    label: 'Easy',
    cardMs: 1200,
    feedbackMs: 750,
    missMs: 1700,
    animation: 1.1,
    table: { card: 600, hit: 700, holeFlip: 750, collect: 700 },
  },
  normal: {
    label: 'Normal',
    cardMs: 950,
    feedbackMs: 650,
    missMs: 1600,
    animation: 1.2,
    table: { card: 550, hit: 620, holeFlip: 700, collect: 600 },
  },
  fast: {
    label: 'Fast',
    cardMs: 750,
    feedbackMs: 550,
    missMs: 1500,
    animation: 1.4,
    table: { card: 450, hit: 520, holeFlip: 580, collect: 500 },
  },
  veryFast: {
    label: 'Very fast',
    cardMs: 600,
    feedbackMs: 450,
    missMs: 1400,
    animation: 1.6,
    table: { card: 380, hit: 440, holeFlip: 500, collect: 420 },
  },
  casino: {
    label: 'Casino',
    cardMs: 500,
    feedbackMs: 400,
    missMs: 1300,
    animation: 1.8,
    table: { card: 320, hit: 380, holeFlip: 430, collect: 360 },
  },
};

export function speedProfile(preset: SpeedPreset): SpeedProfile {
  return SPEED_PROFILES[preset];
}

// ---------------------------------------------------------------------------
// Answer meter
// ---------------------------------------------------------------------------

/**
 * The answer meter starts full when a level begins and drains while a question
 * is open; empty ends the run. Every right answer tops it up by this much, so
 * the pace it demands settles at a quarter of the full-to-empty time per
 * answer (Card Values on the first casino: three seconds a card).
 */
export const METER_TOP_UP = 0.25;

/**
 * Full-to-empty time on each casino's opening level (ms). The clock is the
 * casino's, not the drill's: every casino up the ladder drains faster than
 * the one before, whatever it is teaching.
 */
const METER_MAP_MS: readonly number[] = [12000, 10000, 8500, 7500, 6500, 5500];

/**
 * Later levels of a casino tighten a touch — never past the next casino's
 * opener, so the ladder only ever gets quicker.
 */
const METER_LEVEL_FACTOR: readonly number[] = [1, 1, 0.95, 0.95, 0.9, 0.9];

/** How long the meter takes to drain from full to empty on this level (ms). */
export function meterDrainMs(mapId: number, level: number): number {
  const mapMs = METER_MAP_MS[Math.min(mapId, METER_MAP_MS.length) - 1] ?? METER_MAP_MS[0];
  const levelFactor = METER_LEVEL_FACTOR[Math.min(level, METER_LEVEL_FACTOR.length) - 1] ?? 1;
  return Math.round(mapMs * levelFactor);
}

// ---------------------------------------------------------------------------
// Level specs
// ---------------------------------------------------------------------------

export type QuestionKind = 'runningCount' | 'decksRemaining' | 'trueCount';

/** How a count check is answered: four buttons, or an exact-entry stepper. */
export type AnswerInput = 'choices' | 'entry';

/**
 * Which question each checkpoint asks:
 *   alternate — cycle through `questions` in order, one per checkpoint
 *   random    — a balanced shuffle (running count gets at least half)
 *   paired    — every checkpoint asks all of `questions`, in order
 */
export type QuestionOrder = 'alternate' | 'random' | 'paired';

export interface PassRule {
  /** Checkpoints that must be answered correctly (all parts right). */
  readonly minCorrect: number;
  /** Running-count checkpoints that may be missed on top of `minCorrect`. */
  readonly maxRunningCountMisses: number;
}

interface LevelBase {
  readonly level: number;
  readonly title: string;
  /** One or two sentences shown before the level starts. */
  readonly brief: string;
  readonly speed: SpeedPreset;
}

/**
 * Streak drills are a run of `streakTarget` right answers with `strikes`
 * misses to spare: a miss costs a strike (and a star), never the count, and
 * one more miss than the strikes ends the run. Early maps forgive three,
 * then two, then one; from map 4 a single miss ends it.
 */
interface StreakBase extends LevelBase {
  /** Right answers that clear the level. */
  readonly streakTarget: number;
  /** Misses the run survives. 0 = the first miss ends it. */
  readonly strikes: number;
}

export interface CardValueLevel extends StreakBase {
  readonly mode: 'cardValue';
}

export interface CardGroupLevel extends StreakBase {
  readonly mode: 'cardGroup';
  /** Cards per group. `progressive` climbs through the list as the run goes. */
  readonly groupSizes: readonly number[];
  readonly groupOrder: 'progressive' | 'random';
  /** Bias the deal toward cancelling pairs (+1/−1) and ±2 pairs. */
  readonly emphasizeCancellation: boolean;
}

export interface DeckEstimateLevel extends StreakBase {
  readonly mode: 'deckEstimate';
  /** The shoe shown is one of these sizes. */
  readonly shoeSizes: readonly DeckCount[];
  /** Answer granularity in decks. */
  readonly precision: 1 | 0.5;
  /** Cut the shoe anywhere (answers snap to the nearest half) instead of on clean marks. */
  readonly anyPenetration: boolean;
  /** Draw deck graduations beside the tray. */
  readonly showDeckScale: boolean;
}

export interface TrueCountLevel extends StreakBase {
  readonly mode: 'trueCount';
  /** Decks remaining may be x.5 values. */
  readonly halfDecks: boolean;
  /** Negative running counts appear. */
  readonly negatives: boolean;
  /** Only ask divisions with a whole-number answer. */
  readonly cleanDivision: boolean;
}

export interface CountStreamLevel extends LevelBase {
  readonly mode: 'countStream';
  readonly deckCount: DeckCount;
  /** Cards dealt before the level ends (capped at the shoe). */
  readonly cardCount: number;
  readonly checkpoints: number;
  readonly questions: readonly QuestionKind[];
  readonly questionOrder: QuestionOrder;
  readonly pass: PassRule;
  /** Ask for the count after the last card too (a full deck always ends at 0). */
  readonly finalCountQuestion: boolean;
  readonly answerInput: AnswerInput;
  readonly showDeckScale: boolean;
}

/**
 * How the simulated seats play:
 *   dealOnly — two cards each, dealer shows both, nobody plays
 *   autoplay — everyone draws to 17 (the original blackjack count test)
 *   strategy — basic strategy with doubles and splits, dealer plays S17
 */
export type TablePlay = 'dealOnly' | 'autoplay' | 'strategy';

export interface TableCountLevel extends LevelBase {
  readonly mode: 'tableCount';
  readonly deckCount: DeckCount;
  /** Simulated player positions (the dealer is extra). */
  readonly seats: number;
  readonly play: TablePlay;
  /** No new hand starts once this many cards have left the shoe. */
  readonly cardBudget: number;
  readonly checkpoints: number;
  readonly questions: readonly QuestionKind[];
  readonly questionOrder: QuestionOrder;
  readonly pass: PassRule;
  readonly answerInput: AnswerInput;
  readonly showDeckScale: boolean;
  /** Casino noise: chips on the felt, win/loss tags and sounds. Never betting. */
  readonly distractions: boolean;
  /** Final exam: results break accuracy down per question kind. */
  readonly exam: boolean;
}

export type TrainingLevelSpec =
  | CardValueLevel
  | CardGroupLevel
  | DeckEstimateLevel
  | TrueCountLevel
  | CountStreamLevel
  | TableCountLevel;

export type TrainingMode = TrainingLevelSpec['mode'];

export type StreakLevelSpec = CardValueLevel | CardGroupLevel | DeckEstimateLevel | TrueCountLevel;
export type CheckpointLevelSpec = CountStreamLevel | TableCountLevel;

export function isStreakLevel(spec: TrainingLevelSpec): spec is StreakLevelSpec {
  return (
    spec.mode === 'cardValue' ||
    spec.mode === 'cardGroup' ||
    spec.mode === 'deckEstimate' ||
    spec.mode === 'trueCount'
  );
}

export function isCheckpointLevel(spec: TrainingLevelSpec): spec is CheckpointLevelSpec {
  return spec.mode === 'countStream' || spec.mode === 'tableCount';
}

export interface TrainingMapSpec {
  readonly mapId: number;
  /** What this casino teaches, e.g. "Running Count Basics". */
  readonly theme: string;
  readonly levels: readonly TrainingLevelSpec[];
}

const ALL_CORRECT = (count: number): PassRule => ({
  minCorrect: count,
  maxRunningCountMisses: 0,
});

const RC: readonly QuestionKind[] = ['runningCount'];
const RC_DECKS: readonly QuestionKind[] = ['runningCount', 'decksRemaining'];
const RC_DECKS_TC: readonly QuestionKind[] = ['runningCount', 'decksRemaining', 'trueCount'];

/** Total question checkpoints in a level, including the final-count question. */
export function totalCheckpoints(spec: CheckpointLevelSpec): number {
  return spec.checkpoints + (spec.mode === 'countStream' && spec.finalCountQuestion ? 1 : 0);
}

export const TRAINING_MAPS: readonly TrainingMapSpec[] = [
  {
    mapId: 1,
    theme: 'Running Count Basics',
    levels: [
      {
        mode: 'cardValue',
        level: 1,
        title: 'Card Values',
        brief:
          'One card at a time. 2–6 count +1, 7–9 count 0, 10 through Ace count −1. Tap the value — 21 right clears it, and you have three strikes. The meter drains while you think; every right answer tops it up.',
        speed: 'beginner',
        streakTarget: 21,
        strikes: 3,
      },
      {
        mode: 'cardGroup',
        level: 2,
        title: 'Two Card Combos',
        brief:
          'Count both cards together. A +1 and a −1 cancel to 0 — see the pair, call the sum. Three strikes.',
        speed: 'easy',
        groupSizes: [2],
        groupOrder: 'progressive',
        emphasizeCancellation: false,
        streakTarget: 21,
        strikes: 3,
      },
      {
        mode: 'cardGroup',
        level: 3,
        title: 'Card Groups',
        brief:
          'Three cards, then four, then five. Cancel what you can and call the net value of the group. Three strikes.',
        speed: 'easy',
        groupSizes: [3, 4, 5],
        groupOrder: 'progressive',
        emphasizeCancellation: false,
        streakTarget: 21,
        strikes: 3,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Running Count Drill',
        brief:
          'Cards come one at a time and the count is never shown. Keep it in your head — when the deal pauses, call the running count. Ten checks, all correct; a miss restarts from zero.',
        speed: 'normal',
        deckCount: 1,
        cardCount: 36,
        checkpoints: 10,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(10),
        finalCountQuestion: false,
        answerInput: 'choices',
        showDeckScale: false,
      },
      {
        mode: 'countStream',
        level: 5,
        title: 'Full Deck Count',
        brief:
          'A whole shuffled deck, one card at a time, a touch quicker. Eight checks plus the final count — a full deck always finishes at 0.',
        speed: 'fast',
        deckCount: 1,
        cardCount: 52,
        checkpoints: 8,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(9),
        finalCountQuestion: true,
        answerInput: 'choices',
        showDeckScale: false,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Blackjack Count Test',
        brief:
          'Real blackjack, dealt and played for you — no chips, no decisions. Count every card you can see, including the hole card when it flips. Six checks, all six right, and the table is yours.',
        speed: 'normal',
        deckCount: 1,
        seats: 1,
        play: 'autoplay',
        cardBudget: 52,
        checkpoints: 6,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(6),
        answerInput: 'choices',
        showDeckScale: false,
        distractions: false,
        exam: false,
      },
    ],
  },
  {
    mapId: 2,
    theme: 'Speed & Cancellation',
    levels: [
      {
        mode: 'cardValue',
        level: 1,
        title: 'Fast Card Values',
        brief: 'Same values, less time to think. Twenty-one right, two strikes.',
        speed: 'fast',
        streakTarget: 21,
        strikes: 2,
      },
      {
        mode: 'cardGroup',
        level: 2,
        title: 'Fast Cancellation',
        brief:
          'Pairs fly by. Spot the ones that cancel to 0 and the +2 / −2 pairs on sight. Twenty-one right, two strikes.',
        speed: 'fast',
        groupSizes: [2],
        groupOrder: 'progressive',
        emphasizeCancellation: true,
        streakTarget: 21,
        strikes: 2,
      },
      {
        mode: 'cardGroup',
        level: 3,
        title: 'Fast Groups',
        brief:
          'Three to six cards at once. Pair off highs against lows first, then count what is left. Twenty-one right, two strikes.',
        speed: 'fast',
        groupSizes: [3, 4, 5, 6],
        groupOrder: 'random',
        emphasizeCancellation: false,
        streakTarget: 21,
        strikes: 2,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Rapid Running Count',
        brief: 'A full deck at a quicker clip. Ten checks, all correct.',
        speed: 'veryFast',
        deckCount: 1,
        cardCount: 52,
        checkpoints: 10,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(10),
        finalCountQuestion: false,
        answerInput: 'choices',
        showDeckScale: false,
      },
      {
        mode: 'tableCount',
        level: 5,
        title: 'Table Groups',
        brief:
          'Two players and the dealer get two cards each. Count each hand as a group and keep one running count for the table. Eight checks, all correct.',
        speed: 'fast',
        deckCount: 1,
        seats: 2,
        play: 'dealOnly',
        cardBudget: 52,
        checkpoints: 8,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(8),
        answerInput: 'choices',
        showDeckScale: false,
        distractions: false,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Two-Deck Endurance',
        brief:
          'Two decks, two players, hands playing out on their own — one continuous count. Ten checks, all correct.',
        speed: 'fast',
        deckCount: 2,
        seats: 2,
        play: 'autoplay',
        cardBudget: 104,
        checkpoints: 10,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(10),
        answerInput: 'choices',
        showDeckScale: false,
        distractions: false,
        exam: false,
      },
    ],
  },
  {
    mapId: 3,
    theme: 'Deck Estimation',
    levels: [
      {
        mode: 'deckEstimate',
        level: 1,
        title: 'Whole Decks',
        brief:
          'Read the discard tray against the shoe. A deck is 52 cards — how many whole decks are still to come? Twenty-one right, one strike.',
        speed: 'normal',
        shoeSizes: [4, 6],
        precision: 1,
        anyPenetration: false,
        showDeckScale: true,
        streakTarget: 21,
        strikes: 1,
      },
      {
        mode: 'deckEstimate',
        level: 2,
        title: 'Half Decks',
        brief: 'Now to the nearest half deck — 26 cards is half a deck. Twenty-one right, one strike.',
        speed: 'normal',
        shoeSizes: [2, 4, 6],
        precision: 0.5,
        anyPenetration: false,
        showDeckScale: true,
        streakTarget: 21,
        strikes: 1,
      },
      {
        mode: 'deckEstimate',
        level: 3,
        title: 'Six-Deck Shoe',
        brief:
          'A six-deck shoe cut anywhere. Estimate the decks left to the nearest half. Twenty-one right, one strike.',
        speed: 'normal',
        shoeSizes: [6],
        precision: 0.5,
        anyPenetration: true,
        showDeckScale: true,
        streakTarget: 21,
        strikes: 1,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Count + Decks',
        brief:
          'Keep the running count while the tray fills. Checks alternate: running count, then decks remaining. Ten checks, all correct.',
        speed: 'normal',
        deckCount: 2,
        cardCount: 92,
        checkpoints: 10,
        questions: RC_DECKS,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(10),
        finalCountQuestion: false,
        answerInput: 'choices',
        showDeckScale: true,
      },
      {
        mode: 'countStream',
        level: 5,
        title: 'Four-Deck Tracking',
        brief:
          'Four decks, twelve questions in random order — running count or decks remaining. Ten right passes, but every running-count question must be correct.',
        speed: 'fast',
        deckCount: 4,
        cardCount: 160,
        checkpoints: 12,
        questions: RC_DECKS,
        questionOrder: 'random',
        pass: { minCorrect: 10, maxRunningCountMisses: 0 },
        finalCountQuestion: false,
        answerInput: 'choices',
        showDeckScale: true,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Six-Deck Table',
        brief:
          'Six decks on a live table. Fourteen checks mixing running count and decks remaining: twelve right, and no more than one count miss.',
        speed: 'fast',
        deckCount: 6,
        seats: 2,
        play: 'autoplay',
        cardBudget: 190,
        checkpoints: 14,
        questions: RC_DECKS,
        questionOrder: 'random',
        pass: { minCorrect: 12, maxRunningCountMisses: 1 },
        answerInput: 'choices',
        showDeckScale: true,
        distractions: false,
        exam: false,
      },
    ],
  },
  {
    mapId: 4,
    theme: 'True Count',
    levels: [
      {
        mode: 'trueCount',
        level: 1,
        title: 'Clean Division',
        brief:
          'True count = running count ÷ decks remaining. Whole decks and clean division: +8 with 2 decks left is +4. Twenty-one in a row — no strikes.',
        speed: 'normal',
        halfDecks: false,
        negatives: false,
        cleanDivision: true,
        streakTarget: 21,
        strikes: 0,
      },
      {
        mode: 'trueCount',
        level: 2,
        title: 'Half-Deck Division',
        brief:
          'Half decks now: +6 ÷ 1.5 = +4, +5 ÷ 2.5 = +2. When a division is not clean, round to the nearest half (2.24 → 2, 2.25 → 2.5). Twenty-one in a row — no strikes.',
        speed: 'normal',
        halfDecks: true,
        negatives: false,
        cleanDivision: true,
        streakTarget: 21,
        strikes: 0,
      },
      {
        mode: 'trueCount',
        level: 3,
        title: 'Positive & Negative',
        brief:
          'Negative counts divide the same way, and every answer rounds to the nearest half. Twenty-one in a row — no strikes.',
        speed: 'fast',
        halfDecks: true,
        negatives: true,
        cleanDivision: false,
        streakTarget: 21,
        strikes: 0,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Live True Count',
        brief:
          'Cards keep coming. At each pause, estimate the decks remaining, then give the true count from the decks shown. Ten checks, nine right.',
        speed: 'normal',
        deckCount: 2,
        cardCount: 92,
        checkpoints: 10,
        questions: ['decksRemaining', 'trueCount'],
        questionOrder: 'paired',
        pass: { minCorrect: 9, maxRunningCountMisses: 0 },
        finalCountQuestion: false,
        answerInput: 'choices',
        showDeckScale: true,
      },
      {
        mode: 'countStream',
        level: 5,
        title: 'Four-Deck Mix',
        brief:
          'Twelve random questions — running count, decks remaining or true count. Eleven right.',
        speed: 'fast',
        deckCount: 4,
        cardCount: 160,
        checkpoints: 12,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 11, maxRunningCountMisses: 1 },
        finalCountQuestion: false,
        answerInput: 'choices',
        showDeckScale: true,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Six-Deck True Count',
        brief:
          'Live six-deck blackjack with two players. Fourteen checks of every kind — thirteen right.',
        speed: 'fast',
        deckCount: 6,
        seats: 2,
        play: 'autoplay',
        cardBudget: 190,
        checkpoints: 14,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 13, maxRunningCountMisses: 1 },
        answerInput: 'choices',
        showDeckScale: true,
        distractions: false,
        exam: false,
      },
    ],
  },
  {
    mapId: 5,
    theme: 'Real Table Counting',
    levels: [
      {
        mode: 'tableCount',
        level: 1,
        title: 'Heads-Up Table',
        brief:
          'One player against the dealer, playing basic strategy for you. Count every card that shows. Eight checks, all correct.',
        speed: 'normal',
        deckCount: 1,
        seats: 1,
        play: 'strategy',
        cardBudget: 52,
        checkpoints: 8,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(8),
        answerInput: 'choices',
        showDeckScale: false,
        distractions: false,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 2,
        title: 'Three Hands',
        brief:
          'Two players plus the dealer. Cards land in a different order now — count them as they fall. Ten checks, all correct.',
        speed: 'normal',
        deckCount: 1,
        seats: 2,
        play: 'strategy',
        cardBudget: 52,
        checkpoints: 10,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(10),
        answerInput: 'choices',
        showDeckScale: false,
        distractions: false,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 3,
        title: 'Full Table',
        brief:
          'Four seats over two decks, splits and doubles included. Every exposed card counts. Ten checks, nine right.',
        speed: 'fast',
        deckCount: 2,
        seats: 4,
        play: 'strategy',
        cardBudget: 104,
        checkpoints: 10,
        questions: RC,
        questionOrder: 'alternate',
        pass: { minCorrect: 9, maxRunningCountMisses: 1 },
        answerInput: 'choices',
        showDeckScale: false,
        distractions: false,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 4,
        title: 'Four-Deck Table',
        brief:
          'Three players, four decks. Twelve random checks — running count, decks remaining or true count. Eleven right.',
        speed: 'fast',
        deckCount: 4,
        seats: 3,
        play: 'strategy',
        cardBudget: 160,
        checkpoints: 12,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 11, maxRunningCountMisses: 1 },
        answerInput: 'choices',
        showDeckScale: true,
        distractions: false,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 5,
        title: 'Six-Deck Pace',
        brief:
          'A full table over six decks, dealt faster with fewer pauses. Fourteen checks, thirteen right.',
        speed: 'veryFast',
        deckCount: 6,
        seats: 4,
        play: 'strategy',
        cardBudget: 200,
        checkpoints: 14,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 13, maxRunningCountMisses: 1 },
        answerInput: 'choices',
        showDeckScale: true,
        distractions: false,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Full Shoe Test',
        brief:
          'Deep into a six-deck shoe with a full table. Sixteen questions of every kind, in no particular order — fifteen right, and your running count has to hold.',
        speed: 'veryFast',
        deckCount: 6,
        seats: 3,
        play: 'strategy',
        cardBudget: cutCardDealtCount(6),
        checkpoints: 16,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 15, maxRunningCountMisses: 1 },
        answerInput: 'choices',
        showDeckScale: true,
        distractions: false,
        exam: false,
      },
    ],
  },
  {
    mapId: 6,
    theme: 'Mastery',
    levels: [
      {
        mode: 'countStream',
        level: 1,
        title: 'Perfect Single Deck',
        brief:
          'Cards stream fast, nothing is shown, and you enter the exact count. Ten checks, all perfect.',
        speed: 'veryFast',
        deckCount: 1,
        cardCount: 52,
        checkpoints: 10,
        questions: RC,
        questionOrder: 'alternate',
        pass: ALL_CORRECT(10),
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
      },
      {
        mode: 'countStream',
        level: 2,
        title: 'Two-Deck Mastery',
        brief:
          'Two decks, exact entry, an occasional deck estimate. Twelve questions, eleven right — every count question correct.',
        speed: 'veryFast',
        deckCount: 2,
        cardCount: 92,
        checkpoints: 12,
        questions: RC_DECKS,
        questionOrder: 'random',
        pass: { minCorrect: 11, maxRunningCountMisses: 0 },
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
      },
      {
        mode: 'countStream',
        level: 3,
        title: 'Six-Deck Mastery',
        brief:
          'Casino speed through six decks. Running count, decks remaining and true count — fourteen questions, thirteen right, no count misses.',
        speed: 'casino',
        deckCount: 6,
        cardCount: 200,
        checkpoints: 14,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 13, maxRunningCountMisses: 0 },
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
      },
      {
        mode: 'tableCount',
        level: 4,
        title: 'Casino Distractions',
        brief:
          'A full table with chips moving, wins and losses called — none of it yours. Ignore the noise and count. Fourteen checks, thirteen right.',
        speed: 'fast',
        deckCount: 6,
        seats: 4,
        play: 'strategy',
        cardBudget: 200,
        checkpoints: 14,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 13, maxRunningCountMisses: 1 },
        answerInput: 'entry',
        showDeckScale: false,
        distractions: true,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 5,
        title: 'Endurance Shoe',
        brief:
          'A long six-deck shoe with very few interruptions. Twelve questions of every kind — eleven right.',
        speed: 'veryFast',
        deckCount: 6,
        seats: 3,
        play: 'strategy',
        cardBudget: cutCardDealtCount(6),
        checkpoints: 12,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 11, maxRunningCountMisses: 1 },
        answerInput: 'entry',
        showDeckScale: false,
        distractions: false,
        exam: false,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Final Card Counter Exam',
        brief:
          'Six decks to the cut card, a full table, casino speed and casino noise. Twenty questions — 90% overall and 90% on the running count to graduate.',
        speed: 'casino',
        deckCount: 6,
        seats: 4,
        play: 'strategy',
        cardBudget: cutCardDealtCount(6),
        checkpoints: 20,
        questions: RC_DECKS_TC,
        questionOrder: 'random',
        pass: { minCorrect: 18, maxRunningCountMisses: 1 },
        answerInput: 'entry',
        showDeckScale: false,
        distractions: true,
        exam: true,
      },
    ],
  },
];

export function trainingMapSpec(mapId: number): TrainingMapSpec {
  const map = TRAINING_MAPS.find((entry) => entry.mapId === mapId);
  if (!map) {
    throw new RangeError(`No training ladder for map ${mapId}`);
  }
  return map;
}

export function trainingLevelsForMap(mapId: number): readonly TrainingLevelSpec[] {
  return trainingMapSpec(mapId).levels;
}

export function trainingLevelSpec(mapId: number, level: number): TrainingLevelSpec {
  const spec = trainingMapSpec(mapId).levels[level - 1];
  if (!spec || level < 1 || level > FLASH_LEVELS_PER_MAP) {
    throw new RangeError(`No training level ${level} on map ${mapId}`);
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Answer choices and stars
// ---------------------------------------------------------------------------

export const CHOICE_COUNT = 4;

/**
 * Four unique answers including the right one, spread `step` apart within
 * [min, max]. Falls back to whatever fits when the range is tight.
 */
export function buildNumberChoices(
  correct: number,
  step: number,
  min: number,
  max: number,
  random: Rng = defaultRng,
  count = CHOICE_COUNT,
): number[] {
  const candidates: number[] = [];
  for (let k = 1; k <= count + 2; k++) {
    for (const sign of [1, -1]) {
      const value = correct + sign * k * step;
      if (value >= min && value <= max) {
        candidates.push(value);
      }
    }
  }
  const decoys = fisherYatesShuffle(candidates, random).slice(0, count - 1);
  return fisherYatesShuffle([correct, ...decoys], random);
}

/** Streak drills: every miss costs a star, down to one — clean run → 3, one miss → 2, otherwise 1. */
export function starsForStreakRun(misses: number): number {
  return Math.max(1, 3 - misses);
}

/** Checkpoint levels: no misses → 3, one → 2, otherwise 1 (only ever called on a pass). */
export function starsForCheckpointRun(misses: number): number {
  if (misses === 0) {
    return 3;
  }
  return misses === 1 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Streak drills: card values and groups
// ---------------------------------------------------------------------------

export interface CardItem {
  readonly cards: readonly Card[];
  /** Hi-Lo sum of the cards. */
  readonly correct: number;
}

/** Single-deck practice pile; renewed whenever it runs low. */
export function practiceShoe(rng: Rng = defaultRng): Shoe {
  return createShoe(1, rng);
}

function ensureCards(shoe: Shoe, needed: number, rng: Rng): Shoe {
  return cardsRemaining(shoe) < needed ? createShoe(shoe.deckCount, rng) : shoe;
}

/**
 * Draws the first undealt card matching `predicate`, moving it to the top of
 * the pile first so the shoe stays a plain cursor. Null when none is left.
 */
function drawWhere(
  shoe: Shoe,
  predicate: (card: Card) => boolean,
): { readonly shoe: Shoe; readonly card: Card } | null {
  const index = shoe.cards.findIndex((card, i) => i >= shoe.drawnCount && predicate(card));
  if (index === -1) {
    return null;
  }
  const cards = [...shoe.cards];
  [cards[shoe.drawnCount], cards[index]] = [cards[index], cards[shoe.drawnCount]];
  return draw({ ...shoe, cards }, 'faceUp');
}

function sumHiLo(cards: readonly Card[]): number {
  return cards.reduce((sum, card) => sum + hiLoValue(card.rank), 0);
}

/** One face-up card for the value drill. */
export function drawCardValueItem(
  shoe: Shoe,
  rng: Rng = defaultRng,
): { readonly shoe: Shoe; readonly item: CardItem } {
  const ready = ensureCards(shoe, 1, rng);
  const result = draw(ready, 'faceUp');
  return {
    shoe: result.shoe,
    item: { cards: [result.card], correct: hiLoValue(result.card.rank) },
  };
}

/** Pair shapes the cancellation drill leans on. */
const CANCELLATION_PAIRS: readonly (readonly [number, number])[] = [
  [1, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
];

/** Share of groups that are forced into a cancelling / ±2 pair when emphasised. */
const CANCELLATION_BIAS = 0.6;

/**
 * `size` face-up cards from the pile. With `emphasizeCancellation` most pairs
 * are pulled as a +1/−1, +1/+1 or −1/−1 pair so the eye learns those shapes.
 */
export function drawCardGroupItem(
  shoe: Shoe,
  size: number,
  emphasizeCancellation: boolean,
  rng: Rng = defaultRng,
): { readonly shoe: Shoe; readonly item: CardItem } {
  let current = ensureCards(shoe, size, rng);
  const cards: Card[] = [];

  if (emphasizeCancellation && size === 2 && rng() < CANCELLATION_BIAS) {
    const shape = CANCELLATION_PAIRS[Math.floor(rng() * CANCELLATION_PAIRS.length)];
    for (const value of shape) {
      const pulled = drawWhere(current, (card) => hiLoValue(card.rank) === value);
      if (!pulled) {
        break;
      }
      current = pulled.shoe;
      cards.push(pulled.card);
    }
  }

  while (cards.length < size) {
    const result = draw(current, 'faceUp');
    current = result.shoe;
    cards.push(result.card);
  }

  return { shoe: current, item: { cards, correct: sumHiLo(cards) } };
}

/** Group size for the run so far: progressive levels climb through the list as right answers add up. */
export function groupSizeForStreak(spec: CardGroupLevel, streak: number, rng: Rng = defaultRng): number {
  const sizes = spec.groupSizes;
  if (spec.groupOrder === 'random') {
    return sizes[Math.floor(rng() * sizes.length)];
  }
  const perStage = Math.ceil(spec.streakTarget / sizes.length);
  return sizes[Math.min(sizes.length - 1, Math.floor(streak / perStage))];
}

// ---------------------------------------------------------------------------
// Streak drills: deck estimation and true count
// ---------------------------------------------------------------------------

export interface DeckEstimateItem {
  readonly shoeSize: DeckCount;
  /** Cards still in the shoe — what the tray/shoe visual is built from. */
  readonly cardsRemaining: number;
  /** Decks remaining, at the level's precision. */
  readonly correct: number;
  readonly choices: readonly number[];
}

/** A half-deck mark is "clean" when the cut sits within this many cards of it. */
const HALF_DECK_TOLERANCE = 4;
const HALF_DECK = CARDS_PER_DECK / 2;

/** Nearest half-deck estimate for a card count (never below 0.5 for a non-empty shoe). */
export function decksRemainingEstimate(cardsLeft: number): number {
  if (cardsLeft <= 0) {
    return 0;
  }
  return Math.max(0.5, roundToNearestHalf(cardsLeft / CARDS_PER_DECK));
}

/** True count the way the drills teach it: RC ÷ the decks you estimated, nearest half. */
export function trueCountFromDecks(runningCount: number, decksRemaining: number): number {
  if (decksRemaining <= 0) {
    return 0;
  }
  const value = roundToNearestHalf(runningCount / decksRemaining);
  return value === 0 ? 0 : value; // never "-0"
}

/** True when a card count sits close enough to a half-deck mark to estimate fairly. */
export function isNearHalfDeckMark(cardsLeft: number): boolean {
  const offset = cardsLeft % HALF_DECK;
  return offset <= HALF_DECK_TOLERANCE || HALF_DECK - offset <= HALF_DECK_TOLERANCE;
}

function jitter(random: Rng, span: number): number {
  return Math.round((random() * 2 - 1) * span);
}

export function makeDeckEstimateItem(
  spec: DeckEstimateLevel,
  random: Rng = defaultRng,
): DeckEstimateItem {
  const shoeSize = spec.shoeSizes[Math.floor(random() * spec.shoeSizes.length)];
  const total = totalCards(shoeSize);
  let correct: number;
  let remaining: number;

  if (spec.anyPenetration) {
    // Cut anywhere, then nudge onto the nearest half-deck mark so the tray
    // reads unambiguously at the level's precision.
    const raw = HALF_DECK + Math.floor(random() * (total - HALF_DECK));
    correct = decksRemainingEstimate(raw);
    remaining = Math.min(total, Math.max(1, correct * CARDS_PER_DECK + jitter(random, 3)));
  } else {
    const steps = Math.floor(shoeSize / spec.precision);
    correct = (1 + Math.floor(random() * steps)) * spec.precision;
    remaining = Math.min(total, Math.max(1, correct * CARDS_PER_DECK + jitter(random, 2)));
  }

  return {
    shoeSize,
    cardsRemaining: remaining,
    correct,
    choices: buildNumberChoices(correct, spec.precision, spec.precision, shoeSize, random),
  };
}

export interface TrueCountItem {
  readonly runningCount: number;
  readonly decksRemaining: number;
  readonly correct: number;
  readonly choices: readonly number[];
}

const TRUE_COUNT_MAX_QUOTIENT = 5;
const TRUE_COUNT_CHOICE_BOUND = 12;
const TRUE_COUNT_RC_BOUND = 12;

export function makeTrueCountItem(spec: TrueCountLevel, random: Rng = defaultRng): TrueCountItem {
  const deckOptions: number[] = [];
  for (let decks = spec.halfDecks ? 0.5 : 1; decks <= 6; decks += spec.halfDecks ? 0.5 : 1) {
    deckOptions.push(decks);
  }
  const decksRemaining = deckOptions[Math.floor(random() * deckOptions.length)];
  const sign = spec.negatives && random() < 0.5 ? -1 : 1;

  let runningCount: number;
  if (spec.cleanDivision) {
    const quotients: number[] = [];
    for (let q = 1; q <= TRUE_COUNT_MAX_QUOTIENT; q++) {
      if (Number.isInteger(q * decksRemaining)) {
        quotients.push(q);
      }
    }
    const quotient = quotients[Math.floor(random() * quotients.length)];
    runningCount = sign * quotient * decksRemaining;
  } else {
    runningCount = sign * (1 + Math.floor(random() * TRUE_COUNT_RC_BOUND));
  }

  const correct = trueCountFromDecks(runningCount, decksRemaining);
  const step = spec.halfDecks || !spec.cleanDivision ? 0.5 : 1;
  const bound = TRUE_COUNT_CHOICE_BOUND;
  return {
    runningCount,
    decksRemaining,
    correct,
    choices: buildNumberChoices(
      correct,
      step,
      spec.negatives ? -bound : 0,
      bound,
      random,
    ),
  };
}

// ---------------------------------------------------------------------------
// Checkpoint levels: scripts, frames and checkpoints
// ---------------------------------------------------------------------------

/**
 * What just happened on the felt, which also sets the pause that follows:
 * an opening card, a hit / draw, the hole flip, hands splitting, results
 * showing, or the felt being cleared.
 */
export type FrameBeat = 'card' | 'hit' | 'holeFlip' | 'split' | 'settle' | 'collect';

export interface SeatFrame {
  readonly hands: readonly PlayerHand[];
  /** Per hand, once settled (distraction levels show them). */
  readonly results: readonly (HandResult | null)[];
}

export interface TableFrame {
  readonly seats: readonly SeatFrame[];
  readonly dealer: DealerHand | null;
}

export interface StreamFrame {
  readonly beat: FrameBeat;
  /** The card that just became visible, if any. */
  readonly card: Card | null;
  readonly table: TableFrame;
  /** Running count after this frame — the answer to a check here. */
  readonly runningCount: number;
  /** Cards out of the shoe so far, hidden hole included. */
  readonly cardsDrawn: number;
  readonly cardsRemaining: number;
  /** 1-based hand number on table levels; 0 for a plain stream. */
  readonly handNumber: number;
}

export interface QuestionPart {
  readonly kind: QuestionKind;
  readonly correct: number;
}

export interface Checkpoint {
  readonly frameIndex: number;
  /** Asked in order at the same pause (e.g. decks remaining, then true count). */
  readonly parts: readonly QuestionPart[];
  /** The "final count" question after the last card. */
  readonly isFinal: boolean;
}

export interface TrainingScript {
  readonly deckCount: DeckCount;
  readonly frames: readonly StreamFrame[];
  readonly checkpoints: readonly Checkpoint[];
}

const EMPTY_TABLE: TableFrame = { seats: [], dealer: null };

/** Nominal stake on simulated hands — never the player's chips. */
const TRAINING_BET = 10;

/** A check never lands before this many cards have been seen. */
const MIN_CARDS_BEFORE_FIRST_CHECK = 3;

function questionPart(kind: QuestionKind, frame: StreamFrame): QuestionPart {
  switch (kind) {
    case 'runningCount':
      return { kind, correct: frame.runningCount };
    case 'decksRemaining':
      return { kind, correct: decksRemainingEstimate(frame.cardsRemaining) };
    case 'trueCount':
      return {
        kind,
        correct: trueCountFromDecks(
          frame.runningCount,
          decksRemainingEstimate(frame.cardsRemaining),
        ),
      };
  }
}

/** Which kinds each checkpoint asks, per the level's question order. */
export function assignQuestionKinds(
  questions: readonly QuestionKind[],
  order: QuestionOrder,
  count: number,
  random: Rng = defaultRng,
): QuestionKind[][] {
  if (order === 'paired') {
    return Array.from({ length: count }, () => [...questions]);
  }
  if (order === 'alternate' || questions.length === 1) {
    return Array.from({ length: count }, (_, index) => [questions[index % questions.length]]);
  }
  // Balanced shuffle: the running count gets at least half, the rest share evenly.
  const kinds: QuestionKind[] = [];
  const others = questions.filter((kind) => kind !== 'runningCount');
  const rcCount = questions.includes('runningCount') ? Math.ceil(count / 2) : 0;
  for (let i = 0; i < rcCount; i++) {
    kinds.push('runningCount');
  }
  for (let i = 0; kinds.length < count; i++) {
    kinds.push(others[i % others.length]);
  }
  return fisherYatesShuffle(kinds, random).map((kind) => [kind]);
}

/**
 * Spreads `count` checkpoints across the frames where a card became visible:
 * one per equal segment, at a random spot inside it. Deck / true-count checks
 * prefer spots near a half-deck mark so the tray can be read fairly.
 */
export function scheduleCheckpoints(
  frames: readonly StreamFrame[],
  spec: Pick<CheckpointLevelSpec, 'checkpoints' | 'questions' | 'questionOrder'>,
  random: Rng = defaultRng,
  reserveLastFrame = false,
): Checkpoint[] {
  const lastEligible = reserveLastFrame ? frames.length - 2 : frames.length - 1;
  const eligible: number[] = [];
  let seen = 0;
  frames.forEach((frame, index) => {
    if (frame.card !== null) {
      seen += 1;
      if (seen > MIN_CARDS_BEFORE_FIRST_CHECK && index <= lastEligible) {
        eligible.push(index);
      }
    }
  });

  const count = Math.min(spec.checkpoints, eligible.length);
  const kinds = assignQuestionKinds(spec.questions, spec.questionOrder, count, random);
  const segment = eligible.length / Math.max(1, count);
  const checkpoints: Checkpoint[] = [];

  for (let k = 0; k < count; k++) {
    const from = Math.floor(k * segment);
    const to = Math.max(from, Math.floor((k + 1) * segment) - 1);
    let pool = eligible.slice(from, to + 1);
    if (kinds[k].some((kind) => kind !== 'runningCount')) {
      const fair = pool.filter((index) => isNearHalfDeckMark(frames[index].cardsRemaining));
      if (fair.length > 0) {
        pool = fair;
      }
    }
    const frameIndex = pool[Math.floor(random() * pool.length)];
    checkpoints.push({
      frameIndex,
      parts: kinds[k].map((kind) => questionPart(kind, frames[frameIndex])),
      isFinal: false,
    });
  }
  return checkpoints;
}

/** One card at a time from a fresh shoe — the running-count stream. */
export function buildCountStreamScript(
  spec: CountStreamLevel,
  rng: Rng = defaultRng,
  random: Rng = rng,
): TrainingScript {
  let shoe = createShoe(spec.deckCount, rng);
  const count = Math.min(spec.cardCount, totalCards(spec.deckCount));
  const frames: StreamFrame[] = [];
  let runningCount = 0;

  for (let i = 0; i < count; i++) {
    const result = draw(shoe, 'faceUp');
    shoe = result.shoe;
    runningCount += hiLoValue(result.card.rank);
    frames.push({
      beat: 'card',
      card: result.card,
      table: EMPTY_TABLE,
      runningCount,
      cardsDrawn: shoe.drawnCount,
      cardsRemaining: cardsRemaining(shoe),
      handNumber: 0,
    });
  }

  const checkpoints = scheduleCheckpoints(frames, spec, random, spec.finalCountQuestion);
  if (spec.finalCountQuestion && frames.length > 0) {
    const last = frames[frames.length - 1];
    checkpoints.push({
      frameIndex: frames.length - 1,
      parts: [{ kind: 'runningCount', correct: last.runningCount }],
      isFinal: true,
    });
  }
  return { deckCount: spec.deckCount, frames, checkpoints };
}

/** Fewest cards a new hand may start with — beyond that the shoe is "done". */
export function minCardsForHand(spec: Pick<TableCountLevel, 'seats' | 'play'>): number {
  return spec.play === 'dealOnly' ? 2 * (spec.seats + 1) : 6 + 3 * spec.seats;
}

interface HandDeal {
  readonly shoe: Shoe;
  readonly runningCount: number;
  /** False when the shoe ran dry mid-hand (frames up to that point were emitted). */
  readonly completed: boolean;
}

/** Picks the basic-strategy action the engine will actually accept. */
function chooseAction(round: RoundState, hand: PlayerHand): PlayerAction {
  const canDoubleNow = canDouble(hand);
  const canSplitNow = canSplit(hand, round.splitUsed);
  const rec = recommendForHand(hand, round.dealerHand.cards[1].rank, {
    canDouble: canDoubleNow,
    canSplit: canSplitNow,
  });
  const legal = (action: PlayerAction | undefined): action is PlayerAction =>
    action !== undefined &&
    (action === 'hit' ||
      action === 'stand' ||
      (action === 'double' && canDoubleNow) ||
      (action === 'split' && canSplitNow));
  if (legal(rec.preferredAction)) {
    return rec.preferredAction;
  }
  return legal(rec.fallbackAction) ? rec.fallbackAction : 'stand';
}

/**
 * Deals and plays one multi-seat hand, emitting a frame for every card that
 * lands (and for the hole flip, splits, results and the clear). The dealer's
 * hole stays face down until the dealer's turn, exactly like the live table.
 */
function dealTableHand(
  spec: TableCountLevel,
  shoeIn: Shoe,
  handNumber: number,
  runningCountIn: number,
  emit: (frame: StreamFrame) => void,
): HandDeal {
  let shoe = shoeIn;
  let runningCount = runningCountIn;
  let seats: PlayerHand[][] = Array.from({ length: spec.seats }, (_, seat) => [
    createPlayerHand(`h${handNumber}-s${seat}`, TRAINING_BET),
  ]);
  let results: (HandResult | null)[][] = seats.map(() => [null]);
  let dealer = createDealerHand();

  const snapshot = (): TableFrame => ({
    seats: seats.map((hands, seat) => ({ hands, results: results[seat] })),
    dealer,
  });
  const frame = (beat: FrameBeat, card: Card | null): void => {
    if (card && isFaceUp(card)) {
      runningCount += hiLoValue(card.rank);
    }
    emit({
      beat,
      card: card && isFaceUp(card) ? card : null,
      table: snapshot(),
      runningCount,
      cardsDrawn: shoe.drawnCount,
      cardsRemaining: cardsRemaining(shoe),
      handNumber,
    });
  };
  const take = (visibility: 'faceUp' | 'faceDown'): Card => {
    const result = draw(shoe, visibility);
    shoe = result.shoe;
    return result.card;
  };

  try {
    // Opening deal, two rounds around the table; the dealer's first card is
    // the hole (face down) unless nobody plays the hand out.
    for (let round = 0; round < 2; round++) {
      for (let seat = 0; seat < spec.seats; seat++) {
        const card = take('faceUp');
        seats[seat] = [addCard(seats[seat][0], card)];
        frame('card', card);
      }
      const dealerCard = take(round === 0 && spec.play !== 'dealOnly' ? 'faceDown' : 'faceUp');
      dealer = addCard(dealer, dealerCard);
      frame('card', dealerCard);
    }

    if (spec.play === 'dealOnly') {
      dealer = { ...dealer, holeRevealed: true };
      seats = [];
      results = [];
      dealer = createDealerHand();
      frame('collect', null);
      return { shoe, runningCount, completed: true };
    }

    // Player turns, seat by seat.
    for (let seat = 0; seat < spec.seats; seat++) {
      if (spec.play === 'autoplay') {
        let hand = seats[seat][0];
        while (evaluateCards(hand.cards).total < FLASH_AUTOPLAY_STAND) {
          const card = take('faceUp');
          hand = addCard(hand, card);
          seats[seat] = [hand];
          frame('hit', card);
        }
        const busted = evaluateCards(hand.cards).total > 21;
        seats[seat] = [{ ...hand, status: busted ? 'busted' : 'stood' }];
        continue;
      }

      const opening = seats[seat][0];
      let round: RoundState = {
        playerHands: [isNaturalBlackjack(opening) ? { ...opening, status: 'stood' } : opening],
        dealerHand: dealer,
        activeHandIndex: isNaturalBlackjack(opening) ? null : 0,
        splitUsed: false,
        baseBet: TRAINING_BET,
      };
      while (round.activeHandIndex !== null) {
        const hand = round.playerHands[round.activeHandIndex];
        const action = chooseAction(round, hand);
        const step = applyPlayerAction(round, shoe, action);
        shoe = step.shoe;
        if (action === 'split') {
          const [right, left] = step.round.playerHands;
          seats[seat] = [
            { ...right, cards: right.cards.slice(0, 1) },
            { ...left, cards: left.cards.slice(0, 1) },
          ];
          results[seat] = [null, null];
          frame('split', null);
          seats[seat] = [right, { ...left, cards: left.cards.slice(0, 1) }];
          frame('hit', right.cards[1]);
          seats[seat] = [right, left];
          frame('hit', left.cards[1]);
        } else {
          seats[seat] = [...step.round.playerHands];
          for (const event of step.events) {
            if (event.type === 'cardBecameVisible') {
              frame('hit', event.card);
            }
          }
        }
        round = step.round;
      }
      seats[seat] = [...round.playerHands];
    }

    // Dealer's turn: flip the hole, then draw. The original count test always
    // drew to 17; the strategy tables follow the real rule (no draw when
    // every hand at the table has busted).
    const hole = withVisibility(dealer.cards[0], 'faceUp');
    dealer = { ...dealer, cards: [hole, ...dealer.cards.slice(1)], holeRevealed: true };
    frame('holeFlip', hole);

    const everyoneBusted = seats.every((hands) => hands.every((hand) => hand.status === 'busted'));
    const dealerDraws = spec.play === 'autoplay' || !everyoneBusted;
    while (dealerDraws && dealerShouldHit(dealer)) {
      const card = take('faceUp');
      dealer = addCard(dealer, card);
      frame('hit', card);
    }

    results = seats.map((hands) => hands.map((hand) => resolveHand(hand, dealer)));
    if (spec.distractions) {
      frame('settle', null);
    }

    seats = [];
    results = [];
    dealer = createDealerHand();
    frame('collect', null);
    return { shoe, runningCount, completed: true };
  } catch (error) {
    if (error instanceof EmptyShoeError) {
      return { shoe, runningCount, completed: false };
    }
    throw error;
  }
}

/** Autoplayed blackjack, hand after hand, until the card budget or the shoe runs out. */
export function buildTableScript(
  spec: TableCountLevel,
  rng: Rng = defaultRng,
  random: Rng = rng,
): TrainingScript {
  let shoe = createShoe(spec.deckCount, rng);
  const frames: StreamFrame[] = [];
  const budget = Math.min(spec.cardBudget, totalCards(spec.deckCount));
  const minCards = minCardsForHand(spec);
  let runningCount = 0;
  let handNumber = 0;

  while (shoe.drawnCount < budget && cardsRemaining(shoe) >= minCards) {
    handNumber += 1;
    const deal = dealTableHand(spec, shoe, handNumber, runningCount, (frame) => frames.push(frame));
    shoe = deal.shoe;
    runningCount = deal.runningCount;
    if (!deal.completed) {
      break;
    }
  }

  return {
    deckCount: spec.deckCount,
    frames,
    checkpoints: scheduleCheckpoints(frames, spec, random),
  };
}

export function buildTrainingScript(
  spec: CheckpointLevelSpec,
  rng: Rng = defaultRng,
  random: Rng = rng,
): TrainingScript {
  return spec.mode === 'countStream'
    ? buildCountStreamScript(spec, rng, random)
    : buildTableScript(spec, rng, random);
}

// ---------------------------------------------------------------------------
// Checkpoint scoring
// ---------------------------------------------------------------------------

export interface KindTally {
  readonly asked: number;
  readonly correct: number;
}

export interface CheckpointTally {
  /** Checkpoints answered so far (all parts). */
  readonly asked: number;
  /** Checkpoints with every part right. */
  readonly correct: number;
  readonly runningCountMisses: number;
  readonly byKind: Readonly<Record<QuestionKind, KindTally>>;
}

export const EMPTY_TALLY: CheckpointTally = {
  asked: 0,
  correct: 0,
  runningCountMisses: 0,
  byKind: {
    runningCount: { asked: 0, correct: 0 },
    decksRemaining: { asked: 0, correct: 0 },
    trueCount: { asked: 0, correct: 0 },
  },
};

/** Folds one answered checkpoint (each part's correctness) into the tally. */
export function recordCheckpoint(
  tally: CheckpointTally,
  parts: readonly QuestionPart[],
  partCorrect: readonly boolean[],
): CheckpointTally {
  const byKind = { ...tally.byKind };
  let rcMissed = false;
  parts.forEach((part, index) => {
    const entry = byKind[part.kind];
    byKind[part.kind] = {
      asked: entry.asked + 1,
      correct: entry.correct + (partCorrect[index] ? 1 : 0),
    };
    if (part.kind === 'runningCount' && !partCorrect[index]) {
      rcMissed = true;
    }
  });
  const allCorrect = partCorrect.every(Boolean);
  return {
    asked: tally.asked + 1,
    correct: tally.correct + (allCorrect ? 1 : 0),
    runningCountMisses: tally.runningCountMisses + (rcMissed ? 1 : 0),
    byKind,
  };
}

/** Whether the pass rule can still be met with every remaining checkpoint right. */
export function canStillPass(rule: PassRule, tally: CheckpointTally, total: number): boolean {
  const misses = tally.asked - tally.correct;
  return total - misses >= rule.minCorrect && tally.runningCountMisses <= rule.maxRunningCountMisses;
}

export function hasPassed(rule: PassRule, tally: CheckpointTally): boolean {
  return tally.correct >= rule.minCorrect && tally.runningCountMisses <= rule.maxRunningCountMisses;
}

/** Whole-percent accuracy, or null when a kind was never asked. */
export function accuracyPercent(entry: KindTally): number | null {
  return entry.asked === 0 ? null : Math.round((entry.correct / entry.asked) * 100);
}
