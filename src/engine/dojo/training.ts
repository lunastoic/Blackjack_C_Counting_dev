import { applyPlayerAction, RoundState } from '../blackjack/round';
import { HandResult, resolveHand } from '../blackjack/resolve';
import { canDouble, canSplit, dealerShouldHit, PlayerAction } from '../blackjack/rules';
import { Card, hiLoValue, isFaceUp, makeCard, Rank, withVisibility } from '../cards/card';
import { CARDS_PER_DECK } from '../cards/deck';
import { betUnitsForTrueCount, BET_SPREAD_MAX } from '../betting/betRamp';
import { floorTrueCount, roundToNearestHalf } from '../counting/trueCount';
import {
  INDEX_PLAYS,
  indexAction,
  IndexPlay,
  indexPlayFor,
  INSURANCE_INDEX,
  TOP_INDEX_PLAY_IDS,
} from '../strategy/indexPlays';
import { evaluateCards, isNaturalBlackjack } from '../hand/evaluate';
import { addCard, createDealerHand, createPlayerHand, DealerHand, PlayerHand } from '../hand/hand';
import { defaultRng, fisherYatesShuffle, Rng } from '../shoe/rng';
import { dealerUpValue, recommendAction, recommendForHand } from '../strategy/recommend';
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
import { GridSpec } from './cancelGrid';
import { CLEAR_STARS, FLASH_AUTOPLAY_STAND, FLASH_LEVELS_PER_MAP } from './countFlash';

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
 * Luna Luxe adds two more: `cancelGrid` (a puzzle of cards that cancel) and
 * count streams dealt as Card Rain or as Zero Hero rounds.
 *
 * The clock is the answer meter: it drains while a question is open, and on
 * Luna Luxe it runs on every level — the grid drains while it is on the felt,
 * the timed streams while a count is asked, and the table night gives each
 * count check its own few seconds. Pure TypeScript — no React / RN imports
 * (see architecture-guard test).
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

// ---------------------------------------------------------------------------
// Combo
// ---------------------------------------------------------------------------

/**
 * Right answers given fast, one after another, build a combo. "Fast" is the
 * meter's own pace — inside the share of the drain one right answer refills —
 * so the bar rises with the casino. A slow right answer holds the combo; a
 * miss drops it.
 */
export function comboFastMs(drainMs: number): number {
  return drainMs * METER_TOP_UP;
}

/** Combo lengths where the multiplier steps up: ×2 at 5, ×3 at 10, ×4 at 15. */
export const COMBO_TIERS: readonly { readonly at: number; readonly multiplier: number }[] = [
  { at: 15, multiplier: 4 },
  { at: 10, multiplier: 3 },
  { at: 5, multiplier: 2 },
];

export function comboMultiplier(combo: number): number {
  return COMBO_TIERS.find((tier) => combo >= tier.at)?.multiplier ?? 1;
}

/** Bonus chips for one fast right answer on a multiplier: 0.2% of the casino's max bet per step. */
const COMBO_CHIP_SHARE = 0.002;

export function comboChips(maxBet: number, multiplier: number): number {
  if (multiplier < 2) {
    return 0;
  }
  return Math.max(1, Math.round(maxBet * COMBO_CHIP_SHARE)) * (multiplier - 1);
}

/** Typing an exact answer takes longer than tapping one of four, so typed levels get more meter. */
export const ENTRY_METER_FACTOR = 1.6;

/** Whether this level's answers are typed rather than picked. */
export function answersByEntry(spec: TrainingLevelSpec): boolean {
  return 'answerInput' in spec && spec.answerInput === 'entry';
}

/** How long the meter takes to drain from full to empty on this level (ms). */
export function meterDrainMs(mapId: number, level: number): number {
  const mapMs = METER_MAP_MS[Math.min(mapId, METER_MAP_MS.length) - 1] ?? METER_MAP_MS[0];
  const levelFactor = METER_LEVEL_FACTOR[Math.min(level, METER_LEVEL_FACTOR.length) - 1] ?? 1;
  return Math.round(mapMs * levelFactor);
}

// ---------------------------------------------------------------------------
// Level specs
// ---------------------------------------------------------------------------

export type QuestionKind = 'runningCount' | 'decksRemaining' | 'trueCount' | 'betUnits' | 'insurance';

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
  /**
   * Staged drills: this many right answers per stage, a star at the end of
   * each (stars at 1×, 2× and 3× the stage). With `stages`, each stage
   * overrides some of the level's own settings — a bigger shoe, half decks,
   * negative counts — so one level climbs through three versions of a skill.
   */
  readonly stageLength?: number;
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
  /**
   * Staged groups: this many right answers at each size, a star at the end
   * of each stage (pairs → ★, threes → ★★, fours → ★★★). Without it the
   * progressive sizes split `streakTarget` evenly and stars follow the usual
   * half / full / half-again targets.
   */
  readonly stageLength?: number;
}

/**
 * Cancel Out: grids of cards to clear by dragging +1s onto −1s and tapping
 * the 7s, 8s and 9s, then calling the count of whatever is left. One grid
 * per star; the meter drains the whole time a grid is on the felt.
 */
export interface CancelGridLevel extends LevelBase {
  readonly mode: 'cancelGrid';
  readonly grids: readonly GridSpec[];
  /** Misses the run survives: a drop that doesn't cancel, a wrong tap or call. */
  readonly strikes: number;
}

export interface DeckEstimateLevel extends StreakBase {
  readonly mode: 'deckEstimate';
  readonly stages?: readonly Partial<Pick<DeckEstimateLevel, 'shoeSizes' | 'precision' | 'anyPenetration' | 'showDeckScale'>>[];
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
  /** Typed from Ganymede on — no four choices to lean on. */
  readonly answerInput: AnswerInput;
  /** The most decks left a question may use (default 6). */
  readonly maxDecks?: number;
  readonly stages?: readonly Partial<
    Pick<TrueCountLevel, 'halfDecks' | 'negatives' | 'cleanDivision' | 'maxDecks'>
  >[];
}

/**
 * Bet sizing: a running count and the decks left, and the trainee sizes the
 * bet in units — true count rounded down, minus one, one to eight units.
 */
/**
 * Count-driven decisions: a hand against the dealer's card, the count, and
 * the call — take insurance or not, or the index play (the chart's play
 * below the index, the deviation at or above it).
 */
export interface IndexPlayLevel extends StreakBase {
  readonly mode: 'indexPlay';
  /** Which spots come up: insurance only, 16 vs 10 alone, the top six, or all of them. */
  readonly plays: 'insurance' | 'sixteenVsTen' | 'top' | 'all' | 'mixed';
  /** Give the true count outright; otherwise the running count and decks left. */
  readonly showTrueCount: boolean;
  /** The most decks left a question may use (default 6). */
  readonly maxDecks?: number;
  readonly stages?: readonly Partial<Pick<IndexPlayLevel, 'plays' | 'showTrueCount' | 'maxDecks'>>[];
}

/**
 * Basic strategy: a two-card hand against the dealer's card — hit, stand,
 * double or split, by the book for the level's shoe. `kinds` picks the hands
 * (hard totals, soft totals with an Ace, pairs); stages can narrow them.
 */
export type StrategyHandKind = 'hard' | 'soft' | 'pairs';

export interface StrategyLevel extends StreakBase {
  readonly mode: 'strategy';
  readonly deckCount: DeckCount;
  readonly kinds: readonly StrategyHandKind[];
  readonly stages?: readonly Partial<Pick<StrategyLevel, 'kinds'>>[];
}

// ---------------------------------------------------------------------------
// Mini-games — each has its own store and screen, a star per wave / grid /
// set / stage (two clear the level), strikes and the draining meter.
// ---------------------------------------------------------------------------

/** Swipe Strategy: hands slide in; swipe ← hit, → stand, ↑ double, ↓ split. */
export interface SwipeStrategyLevel extends LevelBase {
  readonly mode: 'swipeStrategy';
  readonly deckCount: DeckCount;
  readonly waves: number;
  readonly handsPerWave: number;
  readonly strikes: number;
}

/** Divide and Match: drag a count tile onto a deck tile that divides to the target true count. */
export interface DivideMatchLevel extends LevelBase {
  readonly mode: 'divideMatch';
  /** One grid per star. */
  readonly grids: readonly { readonly rows: number; readonly cols: number }[];
  /** Deck tiles run from ½ (or 1) up to this many decks. */
  readonly maxDecks: number;
  readonly halfDecks: boolean;
  readonly strikes: number;
}

/** Chip Rush: true-count cards slide toward an edge; drop the right bet stack before they escape. */
export interface ChipRushLevel extends LevelBase {
  readonly mode: 'chipRush';
  readonly waves: number;
  readonly cardsPerWave: number;
  /** Time a card takes to cross the lane on the first wave, and on the last (ms). */
  readonly crossMsStart: number;
  readonly crossMsEnd: number;
  readonly strikes: number;
}

/** Flip Point: one hand, a count slider sweeping −5 → +5; stop where the best move changes. */
export interface FlipPointLevel extends LevelBase {
  readonly mode: 'flipPoint';
  readonly sets: number;
  readonly handsPerSet: number;
  /** Which index plays come up. */
  readonly plays: 'top' | 'all';
  /** One sweep from −5 to +5 (ms). */
  readonly sweepMs: number;
  /** How far from the index a stop still counts (true-count points). */
  readonly tolerance: number;
  readonly strikes: number;
}

/** Busy Table: a whole table flashes, flips face down, and the player types its count. */
export interface BusyTableLevel extends LevelBase {
  readonly mode: 'busyTable';
  /** One stage per star. */
  readonly stages: readonly {
    readonly deckCount: DeckCount;
    readonly seats: number;
    readonly flashMs: number;
  }[];
  readonly tablesPerStage: number;
  readonly strikes: number;
}

/**
 * Beat the Shoe — each casino's boss. A real shoe at the casino's table: the
 * trainee plays every hand, answers count checks between hands, and on the
 * later casinos sizes every bet, calls insurance and makes the index plays.
 * Every call is graded; the run ends at its hand budget or the cut card, or
 * early when the pit boss backs the player off. The results set the bets
 * beside a flat bettor who played the same cards the same way.
 */
export interface ShoeRunLevel extends LevelBase {
  readonly mode: 'shoeRun';
  /**
   * Each count check gets this long (ms) before it counts as a miss — the
   * table night's version of the answer meter. Omitted: checks wait.
   */
  readonly checkTimeMs?: number;
  /** Every play is graded against the book (and the index plays when on). */
  readonly gradeMoves?: boolean;
  /** The book play glows on the buttons (default: on unless moves are graded). */
  readonly hints?: boolean;
  /** Checks come every `min`–`max` hands instead of every `checkEvery`. */
  readonly checkGap?: { readonly min: number; readonly max: number };
  /** One more bad play than this ends the run. */
  readonly maxMoveMisses?: number;
  /** One more wrong count than this ends the run. */
  readonly maxCountMisses?: number;
  readonly deckCount: DeckCount;
  /** Hands in the run (the cut card can end it sooner). */
  readonly hands: number;
  /** The trainee sizes each bet, graded against the ramp. Otherwise one unit a hand. */
  readonly betting: boolean;
  /** Big jumps in the bet draw heat; too much and the pit boss ends the run. */
  readonly heat: boolean;
  /** Insurance is offered on a dealer Ace and graded. */
  readonly insurance: boolean;
  /** Index spots are graded (and the book hint stays quiet on them). */
  readonly indexPlays: boolean;
  /** Count questions asked before some hands, in turn. */
  readonly checks: readonly QuestionKind[];
  /** Ask a check before every Nth hand (from the second hand on). */
  readonly checkEvery: number;
  readonly answerInput: AnswerInput;
  /** The share of calls right that clears the level, and that earns the third star. */
  readonly clearAccuracy: number;
  readonly perfectAccuracy: number;
}

export interface BetSizeLevel extends StreakBase {
  readonly mode: 'betSize';
  /** Decks remaining may be x.5 values. */
  readonly halfDecks: boolean;
  /** Show the ramp (true count → units) beside the question. */
  readonly showRamp: boolean;
  readonly answerInput: AnswerInput;
  /** Give the true count outright instead of the running count and decks left. */
  readonly showTrueCount?: boolean;
  /** The ramp hides once this many right answers are in. */
  readonly hideRampAfter?: number;
  /** The most decks left a question may use (default 6). */
  readonly maxDecks?: number;
  readonly stages?: readonly Partial<Pick<BetSizeLevel, 'halfDecks' | 'showTrueCount' | 'maxDecks'>>[];
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
  /** The answer meter drains while a check is open (streams otherwise wait). */
  readonly timed?: boolean;
  /** Card Rain: cards drop in from the top of the felt. */
  readonly presentation?: 'rain';
  /**
   * Checks every `min`–`max` cards (inclusive) instead of spread evenly; the
   * deal stops at the last check, so `cardCount` is only a cap.
   */
  readonly checkGap?: { readonly min: number; readonly max: number };
  /**
   * Zero Hero: `count` rounds, each a freshly shuffled deck dealt to a secret
   * stop between `minCards` and `maxCards`, then the count. The count starts
   * over each round; a star per right call, two to clear.
   */
  readonly rounds?: { readonly count: number; readonly minCards: number; readonly maxCards: number };
  /**
   * Long Shift: this many shoes back to back, each dealt to its cut card;
   * the count starts over with every new shoe. Checks come by `checkGap`.
   */
  readonly shoes?: number;
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
  /**
   * Count-Along: one check before every hand (the `questions` asked in
   * order), `checkpoints` hands in all — the hands play themselves.
   * With `insuranceOnAce`, a dealer Ace adds an insurance call mid-hand.
   */
  readonly perHand?: boolean;
  readonly insuranceOnAce?: boolean;
  /**
   * Distraction stages: the casino noise switches on after the first third
   * of the checks, and the stretch adds the dealer's chit-chat.
   */
  readonly stagedDistractions?: boolean;
}

export type TrainingLevelSpec =
  | CardValueLevel
  | CardGroupLevel
  | CancelGridLevel
  | StrategyLevel
  | SwipeStrategyLevel
  | DivideMatchLevel
  | ChipRushLevel
  | FlipPointLevel
  | BusyTableLevel
  | DeckEstimateLevel
  | TrueCountLevel
  | BetSizeLevel
  | IndexPlayLevel
  | ShoeRunLevel
  | CountStreamLevel
  | TableCountLevel;

export type TrainingMode = TrainingLevelSpec['mode'];

export type StreakLevelSpec =
  | CardValueLevel
  | CardGroupLevel
  | StrategyLevel
  | DeckEstimateLevel
  | TrueCountLevel
  | BetSizeLevel
  | IndexPlayLevel;
export type CheckpointLevelSpec = CountStreamLevel | TableCountLevel;

export function isStreakLevel(spec: TrainingLevelSpec): spec is StreakLevelSpec {
  return (
    spec.mode === 'cardValue' ||
    spec.mode === 'cardGroup' ||
    spec.mode === 'strategy' ||
    spec.mode === 'deckEstimate' ||
    spec.mode === 'trueCount' ||
    spec.mode === 'betSize' ||
    spec.mode === 'indexPlay'
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
/** Every question a counter answers at the table, the bet included. */
const RC_DECKS_TC_BET: readonly QuestionKind[] = [
  'runningCount',
  'decksRemaining',
  'trueCount',
  'betUnits',
];

/** Total question checkpoints in a level, including the final-count question. */
export function totalCheckpoints(spec: CheckpointLevelSpec): number {
  if (spec.mode === 'countStream' && spec.rounds) {
    return spec.rounds.count;
  }
  return spec.checkpoints + (spec.mode === 'countStream' && spec.finalCountQuestion ? 1 : 0);
}

/** A Zero Hero level: rounds of a fresh deck, each ending on the count. */
export function isRoundsLevel(spec: TrainingLevelSpec): spec is CountStreamLevel & {
  readonly rounds: NonNullable<CountStreamLevel['rounds']>;
} {
  return spec.mode === 'countStream' && spec.rounds !== undefined;
}

/** The mini-games: each runs on its own store and screen. */
export const MINI_GAME_MODES = [
  'cancelGrid',
  'swipeStrategy',
  'divideMatch',
  'chipRush',
  'flipPoint',
  'busyTable',
] as const;
export type MiniGameMode = (typeof MINI_GAME_MODES)[number];

export function isMiniGame(spec: TrainingLevelSpec): boolean {
  return (MINI_GAME_MODES as readonly string[]).includes(spec.mode);
}

/** The 0-based stage a staged drill is on after `streak` right answers. */
export function stageIndexFor(spec: TrainingLevelSpec, streak: number): number {
  if (!isStreakLevel(spec) || !spec.stageLength) {
    return 0;
  }
  return Math.min(2, Math.floor(streak / spec.stageLength));
}

/** A staged drill's settings for the stage it is on: the level's own, with that stage's overrides. */
export function stagedSpec<T extends TrainingLevelSpec>(spec: T, streak: number): T {
  const stages = (spec as { stages?: readonly object[] }).stages;
  if (!isStreakLevel(spec) || !spec.stageLength || !stages || stages.length === 0) {
    return spec;
  }
  const index = Math.min(stages.length - 1, stageIndexFor(spec, streak));
  return { ...spec, ...stages[index] } as T;
}

/** The meter races this level's questions (streak drills always; streams when timed). */
export function isMeteredLevel(spec: TrainingLevelSpec): boolean {
  if (isCheckpointLevel(spec)) {
    return spec.mode === 'countStream' && spec.timed === true;
  }
  return spec.mode !== 'shoeRun';
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
        mode: 'cancelGrid',
        level: 2,
        title: 'Cancel Out',
        brief:
          'A grid of cards. Drag a +1 onto the nearest −1 and both vanish; tap a 7, 8 or 9 to clear it. When no pairs are left, call the count of what remains. A star per grid, three strikes, and the meter drains while the grid is up — every clear tops it up.',
        speed: 'easy',
        // Five across, four down — twenty cards a grid.
        grids: [
          { rows: 4, cols: 5, maxLeftover: 0 },
          { rows: 4, cols: 5, maxLeftover: 2 },
          { rows: 4, cols: 5, maxLeftover: 3 },
        ],
        strikes: 3,
      },
      {
        mode: 'cardGroup',
        level: 3,
        title: 'Card Groups',
        brief:
          'Pairs first, then three cards, then four — call the net value of each group. Eight right at each size earns a star: the pairs ★, the threes ★★ to clear it, the fours ★★★. Three strikes for the whole run, and the meter keeps draining.',
        speed: 'easy',
        groupSizes: [2, 3, 4],
        groupOrder: 'progressive',
        emphasizeCancellation: true,
        stageLength: 8,
        streakTarget: 16,
        strikes: 3,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Card Rain',
        brief:
          'Cards drop from the top one at a time and the count is never shown. Every 5 to 10 cards the rain stops — type the running count since the first card. Eight checks, two misses allowed, and the meter drains while you answer.',
        speed: 'easy',
        deckCount: 2,
        cardCount: 104,
        checkpoints: 8,
        questions: RC,
        questionOrder: 'alternate',
        pass: { minCorrect: 6, maxRunningCountMisses: 2 },
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
        timed: true,
        presentation: 'rain',
        checkGap: { min: 5, max: 10 },
      },
      {
        mode: 'shoeRun',
        level: 5,
        title: 'Table Night',
        brief:
          'Your first real table: a one-deck shoe and ten hands to play — the glowing button is the book play. Before every hand, call the running count with the clock running. 80% right clears it, every one for three stars.',
        speed: 'normal',
        deckCount: 1,
        hands: 10,
        betting: false,
        heat: false,
        insurance: false,
        indexPlays: false,
        checks: RC,
        checkEvery: 1,
        answerInput: 'choices',
        clearAccuracy: 0.8,
        perfectAccuracy: 1,
        checkTimeMs: 8000,
      },
      {
        mode: 'countStream',
        level: 6,
        title: 'Zero Hero',
        brief:
          'Boss. A shuffled deck, one card at a time — but the deal stops early, somewhere between card 39 and 48. Type the running count. Three rounds, a fresh deck each: two right clears it, all three for three stars. The meter drains while you answer.',
        speed: 'normal',
        deckCount: 1,
        cardCount: 48,
        checkpoints: 3,
        questions: RC,
        questionOrder: 'alternate',
        pass: { minCorrect: 2, maxRunningCountMisses: 1 },
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
        timed: true,
        rounds: { count: 3, minCards: 39, maxCards: 48 },
      },
    ],
  },
  // -------------------------------------------------------------------------
  // Map 2 — Io Inferno: basic strategy (easy, 2 decks)
  // -------------------------------------------------------------------------
  {
    mapId: 2,
    theme: 'Basic Strategy',
    levels: [
      {
        mode: 'strategy',
        level: 1,
        title: 'Hit or Stand?',
        brief:
          'A hand and the dealer’s card. Tap the book play — hit, stand, double or split — before the meter empties. A miss shows the right move and why. Three strikes.',
        speed: 'easy',
        deckCount: 2,
        kinds: ['hard', 'soft', 'pairs'],
        streakTarget: 21,
        strikes: 3,
      },
      {
        mode: 'swipeStrategy',
        level: 2,
        title: 'Swipe Strategy',
        brief:
          'Hands slide in one at a time. Swipe ← to hit, → to stand, ↑ to double, ↓ to split. Fast right swipes build a combo; a wrong one is a strike. A star per wave of ten.',
        speed: 'easy',
        deckCount: 2,
        waves: 3,
        handsPerWave: 10,
        strikes: 3,
      },
      {
        mode: 'strategy',
        level: 3,
        title: 'Strategy Stages',
        brief:
          'Hard totals, then soft totals, then pairs — eight right in each earns a star. Three strikes for the whole run, and the meter keeps draining.',
        speed: 'normal',
        deckCount: 2,
        kinds: ['hard'],
        stageLength: 8,
        stages: [{ kinds: ['hard'] }, { kinds: ['soft'] }, { kinds: ['pairs'] }],
        streakTarget: 16,
        strikes: 3,
      },
      {
        mode: 'shoeRun',
        level: 4,
        title: 'Play and Count',
        brief:
          'Hands come from a two-deck shoe and you play every one — by the book, no glowing hints. Every few hands the deal pauses: type the running count.',
        speed: 'normal',
        deckCount: 2,
        hands: 20,
        betting: false,
        heat: false,
        insurance: false,
        indexPlays: false,
        checks: RC,
        checkEvery: 4,
        checkGap: { min: 3, max: 5 },
        answerInput: 'entry',
        gradeMoves: true,
        clearAccuracy: 0.8,
        perfectAccuracy: 1,
      },
      {
        mode: 'shoeRun',
        level: 5,
        title: 'Table Night',
        brief:
          'Twelve hands at the two-deck table. Every move is graded and nothing glows. Before each hand, call the running count with eight seconds on the clock.',
        speed: 'normal',
        deckCount: 2,
        hands: 12,
        betting: false,
        heat: false,
        insurance: false,
        indexPlays: false,
        checks: RC,
        checkEvery: 1,
        checkTimeMs: 8000,
        answerInput: 'choices',
        gradeMoves: true,
        clearAccuracy: 0.8,
        perfectAccuracy: 1,
      },
      {
        mode: 'shoeRun',
        level: 6,
        title: 'Clean Shoe',
        brief:
          'Boss. A whole two-deck shoe, played by you with no hints, the count called before every hand. A third bad move or a third wrong count ends it. 85% right clears.',
        speed: 'normal',
        deckCount: 2,
        hands: 40,
        betting: false,
        heat: false,
        insurance: false,
        indexPlays: false,
        checks: RC,
        checkEvery: 1,
        answerInput: 'entry',
        gradeMoves: true,
        maxMoveMisses: 2,
        maxCountMisses: 2,
        clearAccuracy: 0.85,
        perfectAccuracy: 1,
      },
    ],
  },
  // -------------------------------------------------------------------------
  // Map 3 — Europa Ice: the true count (easy, 1 → 2 → 4 decks)
  // -------------------------------------------------------------------------
  {
    mapId: 3,
    theme: 'True Count',
    levels: [
      {
        mode: 'deckEstimate',
        level: 1,
        title: 'Decks Left',
        brief:
          'Read the discard tray against the shoe and tap how many decks are still to come. One-deck shoes first, then two, then four — a star for each.',
        speed: 'normal',
        shoeSizes: [1],
        precision: 0.5,
        anyPenetration: false,
        showDeckScale: false,
        stageLength: 8,
        stages: [{ shoeSizes: [1] }, { shoeSizes: [2] }, { shoeSizes: [4] }],
        streakTarget: 16,
        strikes: 3,
      },
      {
        mode: 'divideMatch',
        level: 2,
        title: 'Divide and Match',
        brief:
          'A grid of count tiles and deck tiles, and a target true count on top. Drag a count onto a deck tile that divides to the target — both vanish. A wrong pair is a strike. A star per grid.',
        speed: 'normal',
        grids: [
          { rows: 4, cols: 5 },
          { rows: 4, cols: 5 },
          { rows: 4, cols: 5 },
        ],
        maxDecks: 4,
        halfDecks: true,
        strikes: 3,
      },
      {
        mode: 'trueCount',
        level: 3,
        title: 'Division Stages',
        brief:
          'True count = running count ÷ decks left, rounded down. Whole decks first, then half decks, then negative counts — eight right each for a star.',
        speed: 'normal',
        halfDecks: false,
        negatives: false,
        cleanDivision: true,
        answerInput: 'choices',
        maxDecks: 1,
        stageLength: 8,
        stages: [
          { maxDecks: 1, halfDecks: false, negatives: false, cleanDivision: true },
          { maxDecks: 2, halfDecks: true, negatives: false, cleanDivision: false },
          { maxDecks: 4, halfDecks: true, negatives: true, cleanDivision: false },
        ],
        streakTarget: 16,
        strikes: 3,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Live True Count',
        brief:
          'Cards stream from a two-deck shoe. At each pause, type the decks left, then the true count — both must be right. Eight checks, two misses allowed.',
        speed: 'normal',
        deckCount: 2,
        cardCount: 92,
        checkpoints: 8,
        questions: ['decksRemaining', 'trueCount'],
        questionOrder: 'paired',
        pass: { minCorrect: 6, maxRunningCountMisses: 2 },
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
        timed: true,
      },
      {
        mode: 'shoeRun',
        level: 5,
        title: 'Table Night',
        brief:
          'Twelve hands at the four-deck table, your moves graded. Before each hand, call the TRUE count — ten seconds on the clock.',
        speed: 'normal',
        deckCount: 4,
        hands: 12,
        betting: false,
        heat: false,
        insurance: false,
        indexPlays: false,
        checks: ['trueCount'],
        checkEvery: 1,
        checkTimeMs: 10000,
        answerInput: 'choices',
        gradeMoves: true,
        clearAccuracy: 0.8,
        perfectAccuracy: 1,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Count-Along',
        brief:
          'Boss. Two players at a four-deck table and the hands play themselves — you just follow every card. Before each hand, call the running count, then the true count. 85% clears.',
        speed: 'normal',
        deckCount: 4,
        seats: 2,
        play: 'strategy',
        cardBudget: 4 * 52,
        checkpoints: 16,
        questions: ['runningCount', 'trueCount'],
        questionOrder: 'paired',
        pass: { minCorrect: 14, maxRunningCountMisses: 2 },
        answerInput: 'entry',
        showDeckScale: false,
        distractions: false,
        exam: false,
        perHand: true,
      },
    ],
  },
  // -------------------------------------------------------------------------
  // Map 4 — Ganymede: betting the count (medium, 2 → 4 → 6 decks)
  // -------------------------------------------------------------------------
  {
    mapId: 4,
    theme: 'Betting the Count',
    levels: [
      {
        mode: 'betSize',
        level: 1,
        title: 'Bet the Count',
        brief:
          'A true count appears with the bet chart beside it: true count, minus one, from 1 to 8 units. Pick the bet. After ten right the chart hides. Two strikes.',
        speed: 'normal',
        halfDecks: false,
        showRamp: true,
        showTrueCount: true,
        hideRampAfter: 10,
        answerInput: 'choices',
        streakTarget: 21,
        strikes: 2,
      },
      {
        mode: 'chipRush',
        level: 2,
        title: 'Chip Rush',
        brief:
          'True-count cards slide toward the edge. Drag the right chip stack onto the bet circle before each one escapes. They speed up every wave. A star per wave.',
        speed: 'normal',
        waves: 3,
        cardsPerWave: 10,
        crossMsStart: 6000,
        crossMsEnd: 3500,
        strikes: 2,
      },
      {
        mode: 'betSize',
        level: 3,
        title: 'Ramp Stages',
        brief:
          'True count shown first; then the running count and decks left, so you work the bet out yourself; then half decks. Eight right per stage for a star.',
        speed: 'normal',
        halfDecks: false,
        showRamp: true,
        showTrueCount: true,
        maxDecks: 2,
        answerInput: 'entry',
        stageLength: 8,
        stages: [
          { showTrueCount: true, maxDecks: 2, halfDecks: false },
          { showTrueCount: false, maxDecks: 4, halfDecks: false },
          { showTrueCount: false, maxDecks: 6, halfDecks: true },
        ],
        streakTarget: 16,
        strikes: 2,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Count, Then Bet',
        brief:
          'Cards stream from a four-deck shoe and no count is shown. At each pause, type your bet. Ten checks, two misses allowed.',
        speed: 'normal',
        deckCount: 4,
        cardCount: 180,
        checkpoints: 10,
        questions: ['betUnits'],
        questionOrder: 'alternate',
        pass: { minCorrect: 8, maxRunningCountMisses: 2 },
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
        timed: true,
      },
      {
        mode: 'shoeRun',
        level: 5,
        title: 'Table Night',
        brief:
          'Fifteen hands at the six-deck table. You size every bet, and every bet is graded — so are your moves, and a count call every third hand. 85% clears.',
        speed: 'normal',
        deckCount: 6,
        hands: 15,
        betting: true,
        heat: false,
        insurance: false,
        indexPlays: false,
        checks: RC,
        checkEvery: 3,
        answerInput: 'entry',
        gradeMoves: true,
        clearAccuracy: 0.85,
        perfectAccuracy: 1,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Count-Along',
        brief:
          'Boss. Three players at a six-deck table, all on autoplay. Before each hand: the running count, the true count, then your bet. 85% clears.',
        speed: 'fast',
        deckCount: 6,
        seats: 3,
        play: 'strategy',
        cardBudget: 6 * 52,
        checkpoints: 18,
        questions: ['runningCount', 'trueCount', 'betUnits'],
        questionOrder: 'paired',
        pass: { minCorrect: 16, maxRunningCountMisses: 2 },
        answerInput: 'entry',
        showDeckScale: false,
        distractions: false,
        exam: false,
        perHand: true,
      },
    ],
  },
  // -------------------------------------------------------------------------
  // Map 5 — Titan: count-based plays (medium, 4 → 6 → 8 decks)
  // -------------------------------------------------------------------------
  {
    mapId: 5,
    theme: 'Playing the Count',
    levels: [
      {
        mode: 'indexPlay',
        level: 1,
        title: 'Insurance Call',
        brief:
          'The dealer shows an Ace and the true count is shown. Take insurance only at +3 or higher. Two strikes.',
        speed: 'normal',
        plays: 'insurance',
        showTrueCount: true,
        streakTarget: 21,
        strikes: 2,
      },
      {
        mode: 'flipPoint',
        level: 2,
        title: 'Flip Point',
        brief:
          'One hand and a count slider sweeping from −5 to +5. Tap STOP where the best move changes. Within half a point is right. A star per set of five hands.',
        speed: 'normal',
        sets: 3,
        handsPerSet: 5,
        plays: 'top',
        sweepMs: 6000,
        tolerance: 0.5,
        strikes: 2,
      },
      {
        mode: 'indexPlay',
        level: 3,
        title: 'Play Change Stages',
        brief:
          'The top plays first, then all of them, then mixed in with normal hands — so you learn when NOT to change. Eight right per stage for a star.',
        speed: 'normal',
        plays: 'top',
        showTrueCount: true,
        stageLength: 8,
        stages: [{ plays: 'top' }, { plays: 'all' }, { plays: 'mixed' }],
        streakTarget: 16,
        strikes: 2,
      },
      {
        mode: 'indexPlay',
        level: 4,
        title: 'Change or Not',
        brief:
          'A fast stream of hands, each with its count. About one in three is a special play; the rest follow the normal chart. Two strikes.',
        speed: 'fast',
        plays: 'mixed',
        showTrueCount: true,
        streakTarget: 14,
        strikes: 2,
      },
      {
        mode: 'shoeRun',
        level: 5,
        title: 'Table Night',
        brief:
          'Fifteen hands at the eight-deck table. Insurance, special plays, bets and your count are all graded. 85% clears.',
        speed: 'normal',
        deckCount: 8,
        hands: 15,
        betting: true,
        heat: false,
        insurance: true,
        indexPlays: true,
        checks: ['trueCount'],
        checkEvery: 3,
        answerInput: 'entry',
        gradeMoves: true,
        clearAccuracy: 0.85,
        perfectAccuracy: 1,
      },
      {
        mode: 'tableCount',
        level: 6,
        title: 'Count-Along',
        brief:
          'Boss. Three players at an eight-deck table on autoplay. Before each hand: the true count, then your bet. When the dealer shows an Ace, call insurance too. 85% clears.',
        speed: 'fast',
        deckCount: 8,
        seats: 3,
        play: 'strategy',
        cardBudget: 8 * 52,
        checkpoints: 20,
        questions: ['trueCount', 'betUnits'],
        questionOrder: 'paired',
        pass: { minCorrect: 17, maxRunningCountMisses: 3 },
        answerInput: 'entry',
        showDeckScale: false,
        distractions: false,
        exam: false,
        perHand: true,
        insuranceOnAce: true,
      },
    ],
  },
  // -------------------------------------------------------------------------
  // Map 6 — Kepler: the final exam (hard, 4 → 6 → 8 decks)
  // -------------------------------------------------------------------------
  {
    mapId: 6,
    theme: 'Final Exam',
    levels: [
      {
        mode: 'cardGroup',
        level: 1,
        title: 'Casino Speed',
        brief:
          'Single cards and small groups at real dealer speed. Tap the value or total before the fast meter empties. One strike.',
        speed: 'casino',
        groupSizes: [1, 2, 3],
        groupOrder: 'random',
        emphasizeCancellation: false,
        streakTarget: 21,
        strikes: 1,
      },
      {
        mode: 'busyTable',
        level: 2,
        title: 'Busy Table',
        brief:
          'A full table flashes for a moment, then flips face down. Type the count of every card you saw. Bigger shoes and shorter flashes each stage. One strike.',
        speed: 'fast',
        stages: [
          { deckCount: 4, seats: 3, flashMs: 2500 },
          { deckCount: 6, seats: 4, flashMs: 2000 },
          { deckCount: 8, seats: 4, flashMs: 1500 },
        ],
        tablesPerStage: 5,
        strikes: 1,
      },
      {
        mode: 'tableCount',
        level: 3,
        title: 'Distraction Stages',
        brief:
          'A six-deck table. A quiet start, then the chips, sounds and win/loss calls switch on — and for three stars the dealer starts asking you things. Answer, and keep the count.',
        speed: 'fast',
        deckCount: 6,
        seats: 3,
        play: 'strategy',
        cardBudget: 6 * 52,
        checkpoints: 12,
        questions: RC,
        questionOrder: 'alternate',
        pass: { minCorrect: 11, maxRunningCountMisses: 1 },
        answerInput: 'entry',
        showDeckScale: false,
        distractions: false,
        exam: false,
        stagedDistractions: true,
      },
      {
        mode: 'countStream',
        level: 4,
        title: 'Long Shift',
        brief:
          'Two eight-deck shoes back to back at casino speed, the count starting over with the second. Checks come at random about every fifteen cards. One miss ends the shift.',
        speed: 'casino',
        deckCount: 8,
        cardCount: 2 * 8 * 52,
        checkpoints: 36,
        questions: RC,
        questionOrder: 'alternate',
        pass: { minCorrect: 36, maxRunningCountMisses: 0 },
        finalCountQuestion: false,
        answerInput: 'entry',
        showDeckScale: false,
        timed: true,
        checkGap: { min: 12, max: 18 },
        shoes: 2,
      },
      {
        mode: 'shoeRun',
        level: 5,
        title: 'Table Night',
        brief:
          'A long night: 25 hands at the eight-deck table at casino speed. Counts, bets, moves, insurance and special plays all graded. 90% clears.',
        speed: 'casino',
        deckCount: 8,
        hands: 25,
        betting: true,
        heat: false,
        insurance: true,
        indexPlays: true,
        checks: ['runningCount', 'trueCount'],
        checkEvery: 3,
        answerInput: 'entry',
        gradeMoves: true,
        clearAccuracy: 0.9,
        perfectAccuracy: 1,
      },
      {
        mode: 'shoeRun',
        level: 6,
        title: 'Beat the Casino',
        brief:
          'Final boss. A whole eight-deck shoe at casino speed with the pit boss watching. Every count, bet, move, insurance call and special play is graded. 90% with no back-off makes you a card counter.',
        speed: 'casino',
        deckCount: 8,
        hands: 60,
        betting: true,
        heat: true,
        insurance: true,
        indexPlays: true,
        checks: ['runningCount', 'trueCount'],
        checkEvery: 3,
        answerInput: 'entry',
        gradeMoves: true,
        clearAccuracy: 0.9,
        perfectAccuracy: 1,
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

/**
 * Shelved: stars used to score a run by its misses (clean → 3, one → 2,
 * otherwise 1). A run now earns its stars in stages — see `starTargets`.
 */
export function starsForStreakRun(misses: number): number {
  return Math.max(1, 3 - misses);
}

/** Shelved with `starsForStreakRun`: no misses → 3, one → 2, otherwise 1. */
export function starsForCheckpointRun(misses: number): number {
  if (misses === 0) {
    return 3;
  }
  return misses === 1 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Star stages
// ---------------------------------------------------------------------------

/**
 * Every level is one run through three stages, a star each: half the
 * level's target, the target itself, and half again on top. The second star
 * clears the level — the next one opens, and all six open the table; the
 * third is the stretch. The rules (strikes, allowed misses, pace) hold for
 * the whole run, and a star once reached is banked even if the run ends
 * before the next.
 */
export const STAR_COUNT = 3;
const STAR_STAGE_RATIOS = [0.5, 1, 1.5] as const;

export type StarTargets = readonly [number, number, number];

/**
 * What each star asks for: right answers on a streak drill, checks answered
 * on a checkpoint level (its misses are the run's strikes). Halves round up.
 */
export function starTargets(spec: TrainingLevelSpec): StarTargets {
  // One star per grid / wave / set / stage, per stage of a staged drill, or
  // per Zero Hero round called right.
  if (isMiniGame(spec)) {
    return [1, 2, 3];
  }
  if (isStreakLevel(spec) && spec.stageLength) {
    const stage = spec.stageLength;
    return [stage, stage * 2, stage * 3];
  }
  if (isRoundsLevel(spec)) {
    const rounds = spec.rounds.count;
    return [Math.ceil(rounds / 3), Math.ceil((rounds * 2) / 3), rounds];
  }
  const base = isCheckpointLevel(spec)
    ? totalCheckpoints(spec)
    : spec.mode === 'shoeRun'
      ? spec.hands
      : (spec as StreakLevelSpec).streakTarget;
  return [
    Math.round(base * STAR_STAGE_RATIOS[0]),
    Math.round(base * STAR_STAGE_RATIOS[1]),
    Math.round(base * STAR_STAGE_RATIOS[2]),
  ];
}

/** Stars a run has reached at `progress` right answers / checks answered. */
export function starsReached(targets: StarTargets, progress: number): number {
  return targets.filter((target) => progress >= target).length;
}

/** The next star's target, or the last one once every star is in. */
export function nextStarTarget(targets: StarTargets, stars: number): number {
  return targets[Math.min(stars, STAR_COUNT - 1)];
}

/** Whether a run with this many stars has cleared its level. */
export function isClearingStars(stars: number): boolean {
  return stars >= CLEAR_STARS;
}

/**
 * The chips a star pays the first time it is earned on a level, scaled to
 * the casino: 2.5% / 5% / 10% of its maximum bet.
 */
const STAR_CHIP_SHARES = [0.025, 0.05, 0.1] as const;

export function starChips(maxBet: number, star: number): number {
  const share = STAR_CHIP_SHARES[star - 1];
  return share === undefined ? 0 : Math.round(maxBet * share);
}

/**
 * The third star's stage on a checkpoint level: the extra checks, dealt from
 * a fresh shoe at the level's own density. A level that ends on the final
 * count keeps its whole deck so the count still lands on 0.
 */
export function starStretchSpec(spec: CheckpointLevelSpec): CheckpointLevelSpec {
  const [, clear, third] = starTargets(spec);
  const extra = third - clear;
  const share = extra / clear;
  if (spec.mode === 'countStream') {
    return {
      ...spec,
      checkpoints: extra - (spec.finalCountQuestion ? 1 : 0),
      cardCount: spec.finalCountQuestion ? spec.cardCount : Math.round(spec.cardCount * share),
    };
  }
  return { ...spec, checkpoints: extra, cardBudget: Math.round(spec.cardBudget * share) };
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
  const perStage = spec.stageLength ?? Math.ceil(spec.streakTarget / sizes.length);
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

/** True count the way the drills teach it: RC ÷ the decks you estimated, rounded down. */
export function trueCountFromDecks(runningCount: number, decksRemaining: number): number {
  if (decksRemaining <= 0) {
    return 0;
  }
  return floorTrueCount(runningCount / decksRemaining);
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
  const maxDecks = spec.maxDecks ?? 6;
  for (let decks = spec.halfDecks ? 0.5 : 1; decks <= maxDecks; decks += spec.halfDecks ? 0.5 : 1) {
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
  const step = 1;
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

/** Answer codes for a decision: the four plays, then insurance taken or declined. */
export const DECISION = {
  hit: 0,
  stand: 1,
  double: 2,
  split: 3,
  insure: 10,
  noInsurance: 11,
} as const;

const PLAY_CODES: Record<PlayerAction, number> = {
  hit: DECISION.hit,
  stand: DECISION.stand,
  double: DECISION.double,
  split: DECISION.split,
};

export function decisionLabel(code: number): string {
  switch (code) {
    case DECISION.hit:
      return 'Hit';
    case DECISION.stand:
      return 'Stand';
    case DECISION.double:
      return 'Double';
    case DECISION.split:
      return 'Split';
    case DECISION.insure:
      return 'Take insurance';
    default:
      return 'No insurance';
  }
}

export interface IndexPlayItem {
  /** 'insurance' asks take-or-decline; 'play' asks the play. */
  readonly question: 'insurance' | 'play';
  readonly playerCards: readonly Card[];
  readonly dealerUp: Card;
  readonly runningCount: number;
  readonly decksRemaining: number;
  /** The true count the call is made on (rounded down). */
  readonly trueCount: number;
  /** The index this spot turns on. */
  readonly index: number;
  /** "16 vs 10" / "Insurance". */
  readonly label: string;
  readonly correct: number;
  readonly choices: readonly number[];
}

/** Two-card hands for each total the index plays use: no aces, no pairs. */
const HARD_HANDS: Readonly<Record<number, readonly (readonly [Rank, Rank])[]>> = {
  9: [['5', '4'], ['6', '3'], ['7', '2']],
  10: [['6', '4'], ['7', '3'], ['8', '2']],
  11: [['6', '5'], ['7', '4'], ['8', '3'], ['9', '2']],
  12: [['10', '2'], ['9', '3'], ['8', '4'], ['7', '5']],
  13: [['10', '3'], ['9', '4'], ['8', '5'], ['7', '6']],
  15: [['10', '5'], ['9', '6'], ['8', '7']],
  16: [['10', '6'], ['9', '7']],
};
const TENS: readonly Rank[] = ['10', 'J', 'Q', 'K'];
const SUITS_CYCLE = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

function pick<T>(list: readonly T[], random: Rng): T {
  return list[Math.floor(random() * list.length)];
}

function upRankFor(value: number, random: Rng): Rank {
  if (value === 11) {
    return 'A';
  }
  return value === 10 ? pick(TENS, random) : (String(value) as Rank);
}

/** A count on either side of the index, so both answers come up about as often. */
function countAround(index: number, showTrueCount: boolean, random: Rng, maxDecks = 6) {
  const offset = Math.floor(random() * 7) - 3; // −3 … +3
  const target = index + offset;
  if (showTrueCount) {
    return { runningCount: target, decksRemaining: 1, trueCount: target };
  }
  const decksRemaining = 1 + Math.floor(random() * (2 * maxDecks - 1)) / 2; // 1 … maxDecks in halves
  const runningCount = Math.floor(target * decksRemaining + random() * decksRemaining * 0.9);
  return {
    runningCount,
    decksRemaining,
    trueCount: trueCountFromDecks(runningCount, decksRemaining),
  };
}

export function makeIndexPlayItem(spec: IndexPlayLevel, random: Rng = defaultRng): IndexPlayItem {
  // Mixed: about two hands in three are ordinary ones the chart still decides,
  // so the trainee learns when NOT to change; the rest are the top plays.
  if (spec.plays === 'mixed') {
    if (random() < 2 / 3) {
      return makeChartHandItem(spec, random);
    }
    return makeIndexPlayItem({ ...spec, plays: random() < 0.15 ? 'insurance' : 'all' }, random);
  }
  const pool: readonly IndexPlay[] =
    spec.plays === 'top'
      ? INDEX_PLAYS.filter((play) => TOP_INDEX_PLAY_IDS.includes(play.id))
      : spec.plays === 'sixteenVsTen'
        ? INDEX_PLAYS.filter((play) => play.id === '16v10')
        : INDEX_PLAYS;
  // Insurance alone, or one spot in (roughly) five on the full list.
  const insurance = spec.plays === 'insurance' || (spec.plays === 'all' && random() < 0.2);
  let suitIndex = Math.floor(random() * 4);
  const cardOf = (rank: Rank) => {
    suitIndex += 1;
    return makeCard(rank, SUITS_CYCLE[suitIndex % 4], { deckIndex: suitIndex, visibility: 'faceUp' });
  };

  if (insurance) {
    const count = countAround(INSURANCE_INDEX, spec.showTrueCount, random, spec.maxDecks);
    const [a, b] = pick(Object.values(HARD_HANDS).flat(), random);
    const correct = count.trueCount >= INSURANCE_INDEX ? DECISION.insure : DECISION.noInsurance;
    return {
      question: 'insurance',
      playerCards: [cardOf(a), cardOf(b)],
      dealerUp: cardOf('A'),
      ...count,
      index: INSURANCE_INDEX,
      label: 'Insurance',
      correct,
      choices: [DECISION.insure, DECISION.noInsurance],
    };
  }

  const play = pick(pool, random);
  const count = countAround(play.index, spec.showTrueCount, random, spec.maxDecks);
  const ranks: readonly Rank[] =
    play.hand === 'pair10' ? [pick(TENS, random), pick(TENS, random)] : pick(HARD_HANDS[play.hand], random);
  const action = indexAction(play, count.trueCount, { canDouble: true, canSplit: true });
  return {
    question: 'play',
    playerCards: ranks.map(cardOf),
    dealerUp: cardOf(upRankFor(play.up, random)),
    ...count,
    index: play.index,
    label: play.label,
    correct: PLAY_CODES[action],
    choices: [DECISION.hit, DECISION.stand, DECISION.double, DECISION.split],
  };
}

/**
 * An ordinary hand with a count beside it: no index covers it, so the chart
 * play stands whatever the count says.
 */
function makeChartHandItem(spec: IndexPlayLevel, random: Rng): IndexPlayItem {
  for (;;) {
    const hand = makeStrategyItem(['hard', 'soft', 'pairs'], 6, random);
    if (indexPlayFor(hand.playerCards, hand.dealerUp.rank)) {
      continue;
    }
    const count = countAround(Math.floor(random() * 7) - 2, spec.showTrueCount, random, spec.maxDecks);
    return {
      question: 'play',
      playerCards: hand.playerCards,
      dealerUp: hand.dealerUp,
      ...count,
      index: Number.NaN,
      label: hand.label,
      correct: hand.correct,
      choices: hand.choices,
    };
  }
}

// ---------------------------------------------------------------------------
// Streak drills: basic strategy
// ---------------------------------------------------------------------------

export interface StrategyItem {
  readonly kind: StrategyHandKind;
  readonly playerCards: readonly Card[];
  readonly dealerUp: Card;
  /** "Hard 12", "Soft 17", "Pair of 8s". */
  readonly label: string;
  /** DECISION code for the book play. */
  readonly correct: number;
  readonly choices: readonly number[];
  /** One line on why the book play is right. */
  readonly reason: string;
}

const NON_TEN_RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9'];
const UP_RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function rankWorth(rank: Rank): number {
  return rank === 'A' ? 11 : TENS.includes(rank) ? 10 : Number(rank);
}

function strategyRanks(kind: StrategyHandKind, random: Rng): readonly [Rank, Rank] {
  if (kind === 'soft') {
    return ['A', pick(NON_TEN_RANKS, random)];
  }
  if (kind === 'pairs') {
    const rank = pick([...NON_TEN_RANKS, 'A', pick(TENS, random)] as Rank[], random);
    return [rank, rank];
  }
  // Hard: two different values from 2 to 10, totalling 5 to 17.
  for (;;) {
    const a = pick([...NON_TEN_RANKS, ...TENS] as Rank[], random);
    const b = pick([...NON_TEN_RANKS, ...TENS] as Rank[], random);
    const total = rankWorth(a) + rankWorth(b);
    if (rankWorth(a) !== rankWorth(b) && total >= 5 && total <= 17) {
      return [a, b];
    }
  }
}

/** One line on why the book play is right. */
export function strategyReason(action: PlayerAction, kind: StrategyHandKind, upValue: number): string {
  const weak = upValue >= 2 && upValue <= 6;
  const up = upValue === 11 ? 'an Ace' : `a ${upValue}`;
  switch (action) {
    case 'split':
      return `Split — two good hands beat one bad one against ${up}.`;
    case 'double':
      return weak
        ? `Double — ${up} is a bust card, so get more money out.`
        : 'Double — you are the favourite to win this hand.';
    case 'stand':
      return weak
        ? `Stand — ${up} busts often; let the dealer take the risk.`
        : kind === 'soft'
          ? 'Stand — this soft total already beats what the dealer usually makes.'
          : 'Stand — you are strong enough already.';
    case 'hit':
      return weak && kind === 'hard'
        ? 'Hit — too low to stand, even against a weak card.'
        : `Hit — ${up} usually makes 17 or more, so you need more.`;
  }
}

/** A basic-strategy question: two cards against the dealer's card, the book play for the shoe. */
export function makeStrategyItem(
  kinds: readonly StrategyHandKind[],
  deckCount: DeckCount,
  random: Rng = defaultRng,
): StrategyItem {
  const kind = pick(kinds, random);
  const [a, b] = strategyRanks(kind, random);
  const upRank = pick(UP_RANKS, random);
  let suitIndex = Math.floor(random() * 4);
  const cardOf = (rank: Rank) => {
    suitIndex += 1;
    return makeCard(rank, SUITS_CYCLE[suitIndex % 4], { deckIndex: suitIndex, visibility: 'faceUp' });
  };
  const playerCards = [cardOf(a), cardOf(b)];
  const dealerUp = cardOf(upRank);
  const { preferredAction } = recommendAction(
    { cards: playerCards, isFromSplit: false },
    upRank,
    { canDouble: true, canSplit: true },
    deckCount,
  );
  const { total } = evaluateCards(playerCards);
  const label =
    kind === 'pairs'
      ? `Pair of ${a === 'A' ? 'Aces' : TENS.includes(a) ? 'tens' : `${a}s`}`
      : kind === 'soft'
        ? `Soft ${total}`
        : `Hard ${total}`;
  return {
    kind,
    playerCards,
    dealerUp,
    label,
    correct: PLAY_CODES[preferredAction],
    choices: [DECISION.hit, DECISION.stand, DECISION.double, DECISION.split],
    reason: strategyReason(preferredAction, kind, dealerUpValue(upRank)),
  };
}

export interface BetSizeItem {
  /** The true count is given outright; running count and decks are not shown. */
  readonly trueCountShown?: boolean;
  readonly runningCount: number;
  readonly decksRemaining: number;
  /** The true count the bet is sized from (rounded down). */
  readonly trueCount: number;
  /** Units to bet. */
  readonly correct: number;
  readonly choices: readonly number[];
}

/** Running counts span a cold shoe to the top of the spread and past it. */
const BET_TRUE_COUNT_RANGE = { min: -2, max: BET_SPREAD_MAX + 2 } as const;

export function makeBetSizeItem(spec: BetSizeLevel, random: Rng = defaultRng): BetSizeItem {
  const deckOptions: number[] = [];
  const maxDecks = spec.maxDecks ?? 6;
  for (let decks = 1; decks <= maxDecks; decks += spec.halfDecks ? 0.5 : 1) {
    deckOptions.push(decks);
  }
  const decksRemaining = deckOptions[Math.floor(random() * deckOptions.length)];
  // Aim at a true count, then land the running count a little above it so
  // the division rarely comes out clean — rounding down is part of the skill.
  const span = BET_TRUE_COUNT_RANGE.max - BET_TRUE_COUNT_RANGE.min + 1;
  const target = BET_TRUE_COUNT_RANGE.min + Math.floor(random() * span);
  const runningCount = Math.round(target * decksRemaining + random() * (decksRemaining - 0.01));
  const trueCount = trueCountFromDecks(runningCount, decksRemaining);
  const correct = betUnitsForTrueCount(trueCount);
  return {
    trueCountShown: spec.showTrueCount === true,
    runningCount,
    decksRemaining,
    trueCount,
    correct,
    choices: buildNumberChoices(correct, 1, 1, BET_SPREAD_MAX, random),
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
  /** Zero Hero: the 1-based round this card belongs to (each round is a fresh deck). */
  readonly round?: number;
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
  /** An extra call (insurance on a dealer Ace) that does not count toward the stars. */
  readonly bonus?: boolean;
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
    case 'betUnits':
      return {
        kind,
        correct: betUnitsForTrueCount(
          trueCountFromDecks(frame.runningCount, decksRemainingEstimate(frame.cardsRemaining)),
        ),
      };
    case 'insurance':
      return {
        kind,
        correct:
          trueCountFromDecks(frame.runningCount, decksRemainingEstimate(frame.cardsRemaining)) >=
          INSURANCE_INDEX
            ? DECISION.insure
            : DECISION.noInsurance,
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

/** A whole number in [min, max]. */
function between(min: number, max: number, random: Rng): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Deals `count` cards one at a time off `shoe`, the count carried from `startCount`. */
function dealStream(
  shoe: Shoe,
  count: number,
  startCount: number,
  round?: number,
): { readonly shoe: Shoe; readonly frames: StreamFrame[] } {
  let current = shoe;
  let runningCount = startCount;
  const frames: StreamFrame[] = [];
  for (let i = 0; i < count; i++) {
    const result = draw(current, 'faceUp');
    current = result.shoe;
    runningCount += hiLoValue(result.card.rank);
    frames.push({
      beat: 'card',
      card: result.card,
      table: EMPTY_TABLE,
      runningCount,
      cardsDrawn: current.drawnCount,
      cardsRemaining: cardsRemaining(current),
      handNumber: 0,
      ...(round !== undefined ? { round } : {}),
    });
  }
  return { shoe: current, frames };
}

/**
 * Card Rain: a check after every `checkGap.min`–`checkGap.max` cards, and the
 * deal stops on the last one. Gaps past the end of the shoe are dropped.
 */
function buildGapScript(spec: CountStreamLevel, rng: Rng, random: Rng): TrainingScript {
  const gap = spec.checkGap!;
  const cap = Math.min(spec.cardCount, totalCards(spec.deckCount));
  const stops: number[] = [];
  let dealt = 0;
  for (let k = 0; k < spec.checkpoints; k++) {
    const next = dealt + between(gap.min, gap.max, random);
    if (next > cap) {
      break;
    }
    stops.push(next);
    dealt = next;
  }
  const { frames } = dealStream(createShoe(spec.deckCount, rng), dealt, 0);
  const checkpoints: Checkpoint[] = stops.map((stop) => ({
    frameIndex: stop - 1,
    parts: [{ kind: 'runningCount' as const, correct: frames[stop - 1].runningCount }],
    isFinal: false,
  }));
  return { deckCount: spec.deckCount, frames, checkpoints };
}

/**
 * Long Shift: `shoes` shoes back to back, each dealt to its cut card with the
 * count starting over, and a check every `checkGap` cards across the shift.
 */
function buildShoesScript(spec: CountStreamLevel, rng: Rng, random: Rng): TrainingScript {
  const gap = spec.checkGap ?? { min: 12, max: 18 };
  const frames: StreamFrame[] = [];
  for (let shoeNumber = 1; shoeNumber <= (spec.shoes ?? 1); shoeNumber++) {
    const dealt = dealStream(createShoe(spec.deckCount, rng), cutCardDealtCount(spec.deckCount), 0, shoeNumber);
    frames.push(...dealt.frames);
  }
  const checkpoints: Checkpoint[] = [];
  let at = -1;
  while (checkpoints.length < spec.checkpoints) {
    at += between(gap.min, gap.max, random);
    if (at >= frames.length) {
      break;
    }
    checkpoints.push({
      frameIndex: at,
      parts: [{ kind: 'runningCount', correct: frames[at].runningCount }],
      isFinal: false,
    });
  }
  return { deckCount: spec.deckCount, frames, checkpoints };
}

/**
 * Zero Hero: each round shuffles a fresh deck, deals it to a secret stop and
 * asks for the count there. Rounds sit end to end in one script; the count
 * starts over at 0 with every round.
 */
function buildRoundsScript(spec: CountStreamLevel, rng: Rng, random: Rng): TrainingScript {
  const rounds = spec.rounds!;
  const frames: StreamFrame[] = [];
  const checkpoints: Checkpoint[] = [];
  for (let round = 1; round <= rounds.count; round++) {
    const stop = Math.min(totalCards(spec.deckCount), between(rounds.minCards, rounds.maxCards, random));
    const dealt = dealStream(createShoe(spec.deckCount, rng), stop, 0, round);
    frames.push(...dealt.frames);
    const last = frames[frames.length - 1];
    checkpoints.push({
      frameIndex: frames.length - 1,
      parts: [{ kind: 'runningCount', correct: last.runningCount }],
      isFinal: true,
    });
  }
  return { deckCount: spec.deckCount, frames, checkpoints };
}

/** One card at a time from a fresh shoe — the running-count stream. */
export function buildCountStreamScript(
  spec: CountStreamLevel,
  rng: Rng = defaultRng,
  random: Rng = rng,
): TrainingScript {
  if (spec.shoes) {
    return buildShoesScript(spec, rng, random);
  }
  if (spec.rounds) {
    return buildRoundsScript(spec, rng, random);
  }
  if (spec.checkGap) {
    return buildGapScript(spec, rng, random);
  }
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
  // Staged distractions deal the results beat every hand; the felt decides when to show it.
  const dealSpec = spec.stagedDistractions ? { ...spec, distractions: true } : spec;
  let runningCount = 0;
  let handNumber = 0;

  while (
    (spec.perHand ? handNumber < spec.checkpoints : shoe.drawnCount < budget) &&
    cardsRemaining(shoe) >= minCards
  ) {
    handNumber += 1;
    const deal = dealTableHand(dealSpec, shoe, handNumber, runningCount, (frame) => frames.push(frame));
    shoe = deal.shoe;
    runningCount = deal.runningCount;
    if (!deal.completed) {
      break;
    }
  }

  return {
    deckCount: spec.deckCount,
    frames,
    checkpoints: spec.perHand ? perHandCheckpoints(frames, spec) : scheduleCheckpoints(frames, spec, random),
  };
}

/**
 * Count-Along: a check as each hand is cleared away (so, before the next
 * one), asking every kind in `questions` in order; with `insuranceOnAce`, a
 * dealer Ace adds a bonus insurance call the moment it lands.
 */
export function perHandCheckpoints(frames: readonly StreamFrame[], spec: TableCountLevel): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];
  frames.forEach((frame, index) => {
    const dealer = frame.table.dealer;
    const upcardLanded =
      frame.beat === 'card' &&
      frame.card !== null &&
      dealer !== null &&
      dealer.cards.length === 2 &&
      dealer.cards[1].id === frame.card.id;
    if (spec.insuranceOnAce && upcardLanded && frame.card?.rank === 'A') {
      checkpoints.push({ frameIndex: index, parts: [questionPart('insurance', frame)], isFinal: false, bonus: true });
    }
    if (frame.beat === 'collect') {
      checkpoints.push({
        frameIndex: index,
        parts: spec.questions.map((kind) => questionPart(kind, frame)),
        isFinal: false,
      });
    }
  });
  return checkpoints;
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
    betUnits: { asked: 0, correct: 0 },
    insurance: { asked: 0, correct: 0 },
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
