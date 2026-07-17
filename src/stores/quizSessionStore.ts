import { create } from 'zustand';
import { CasinoMap, mapById } from '../engine/betting/casino';
import { Card, hiLoValue } from '../engine/cards/card';
import { XP_AWARDS } from '../engine/progression/progression';
import { cardsRemaining, createShoe, DeckCount, draw, Shoe } from '../engine/shoe/shoe';
import { buildCountChoices } from '../utils/countCoach';
import { useEconomyStore } from './economyStore';
import { useModeStatsStore } from './modeStatsStore';
import { useSettingsStore } from './settingsStore';
import { awardXpWithRewards } from './orchestration';
import { LevelUpNotice } from './gameSessionStore';

/**
 * Quiz Mode — the count sprint. 7–10 cards flash FAST, then "What was the
 * count?" with 4 choices. The streak is the difficulty dial:
 *
 *   streak 0–2  7 cards, no tricks, comfortable pace
 *   streak 3–5  8 cards, faster, +1 face-down decoy (backs don't count!)
 *   streak 6–7  9 cards, faster still, 2 decoys
 *   streak 8    10 cards, near-dealer speed, 2 decoys, some cards land in
 *               PAIRS — read two at once and cancel highs against lows.
 *
 * Each correct answer pays 3 XP and fills 1 of 9 golden circles; a wrong
 * answer resets them; filling all 9 pays the 1,000-chip grand prize.
 *
 * Cards come from a real shoe (quiz deck-count setting) so the drills quiz
 * the same distribution the tables use; it reshuffles silently when low.
 */

export const QUIZ_STREAK_TARGET = 9;
export const QUIZ_GRAND_PRIZE_CHIPS = 1000;

export type QuizPhase = 'idle' | 'flashing' | 'question' | 'feedback';

/** One flashed card: face-down decoys show a card back and do NOT count. */
export interface QuizFlashCard {
  readonly card: Card;
  readonly faceDown: boolean;
}

/** One beat of the flash sequence: 1 card, or 2 at once at top difficulty. */
export type QuizFlashStep = readonly QuizFlashCard[];

export interface QuizDifficulty {
  /** Face-up cards that actually move the count. */
  readonly cardCount: number;
  /** Face-down decoys mixed into the sequence. */
  readonly decoyCount: number;
  /** ms each flash step stays up at 1.0× dealer speed. */
  readonly flashMs: number;
  /** Some steps flash two cards at once. */
  readonly pairFlash: boolean;
}

const MAX_DIFFICULTY_STREAK = 8;
/** Streak-indexed face-up card counts (7 → 10 across the 9 circles). */
const CARD_COUNTS = [7, 7, 7, 8, 8, 8, 9, 9, 10] as const;
const BASE_FLASH_MS = 750;
const FLASH_MS_DROP_PER_STREAK = 45;
/** Chance that a step grabs a second card when pair flashing is on. */
const PAIR_CHANCE = 0.4;

export function quizDifficultyForStreak(streak: number): QuizDifficulty {
  const s = Math.max(0, Math.min(MAX_DIFFICULTY_STREAK, streak));
  return {
    cardCount: CARD_COUNTS[s],
    decoyCount: s >= 6 ? 2 : s >= 3 ? 1 : 0,
    flashMs: BASE_FLASH_MS - s * FLASH_MS_DROP_PER_STREAK,
    pairFlash: s >= MAX_DIFFICULTY_STREAK - 1,
  };
}

/** The correct answer counts face-up cards only — decoys are the lesson. */
export function quizCorrectAnswer(flashCards: readonly QuizFlashCard[]): number {
  return flashCards.reduce(
    (sum, item) => (item.faceDown ? sum : sum + hiLoValue(item.card.rank)),
    0,
  );
}

/** Groups the flash order into steps; pairFlash merges some neighbors. */
export function buildFlashSteps(
  flashCards: readonly QuizFlashCard[],
  pairFlash: boolean,
  random: () => number = Math.random,
): QuizFlashStep[] {
  const steps: QuizFlashStep[] = [];
  let i = 0;
  while (i < flashCards.length) {
    const pairUp = pairFlash && i + 1 < flashCards.length && random() < PAIR_CHANCE;
    steps.push(pairUp ? [flashCards[i], flashCards[i + 1]] : [flashCards[i]]);
    i += pairUp ? 2 : 1;
  }
  return steps;
}

/** Shuffles decoys into random positions among the face-up cards. */
export function buildFlashCards(
  cards: readonly Card[],
  decoyCount: number,
  random: () => number = Math.random,
): QuizFlashCard[] {
  const decoyPositions = new Set<number>();
  while (decoyPositions.size < Math.min(decoyCount, cards.length)) {
    decoyPositions.add(Math.floor(random() * cards.length));
  }
  return cards.map((card, index) => ({ card, faceDown: decoyPositions.has(index) }));
}

interface QuizSessionState {
  readonly sessionActive: boolean;
  readonly map: CasinoMap | null;
  readonly phase: QuizPhase;
  readonly shoe: Shoe | null;
  /** Every card in the current question, in flash order (for the review row). */
  readonly flashCards: readonly QuizFlashCard[];
  /** Flash order grouped into 1–2 card beats. */
  readonly steps: readonly QuizFlashStep[];
  /** Index of the step currently displayed (−1 = none). */
  readonly stepIndex: number;
  /** ms per step at 1.0× dealer speed for the current question. */
  readonly flashMs: number;
  readonly correctAnswer: number;
  /** Four multiple-choice options (always contains correctAnswer). */
  readonly choices: readonly number[];
  readonly selectedChoice: number | null;
  readonly wasCorrect: boolean | null;
  /** Golden circles: 0…9 consecutive correct answers. */
  readonly streak: number;
  /** True once the streak hits 9 — the grand prize is claimable. */
  readonly rewardReady: boolean;
  readonly questionsAnswered: number;
  readonly questionsCorrect: number;
  readonly xpAwarded: number;
  readonly levelUpNotice: LevelUpNotice | null;

  startSession(mapId: number): boolean;
  endSession(): void;
  startQuestion(): boolean;
  answer(choice: number): boolean;
  claimGrandPrize(): boolean;
  dismissLevelUp(): void;
}

const timers = new Set<ReturnType<typeof setTimeout>>();

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

function quizShoe(): Shoe {
  const deckCount: DeckCount = useSettingsStore.getState().deckCounts.quiz;
  return createShoe(deckCount);
}

/** Backwards-compatible alias for the shared choice builder. */
export function buildChoices(
  correct: number,
  random: () => number = Math.random,
): number[] {
  return buildCountChoices(correct, random);
}

export const useQuizSessionStore = create<QuizSessionState>()((set, get) => {
  function stepDelay(): number {
    // Reduced motion does not shorten the rhythm — cards simply appear
    // without motion — the reading pace must stay comfortable either way.
    const { dealerSpeed } = useSettingsStore.getState();
    return Math.round(get().flashMs / dealerSpeed);
  }

  function advanceFlash(): void {
    const { phase, stepIndex, steps } = get();
    if (phase !== 'flashing') {
      return;
    }
    const next = stepIndex + 1;
    if (next < steps.length) {
      set({ stepIndex: next });
      schedule(advanceFlash, stepDelay());
    } else {
      set({ phase: 'question', stepIndex: -1 });
    }
  }

  return {
    sessionActive: false,
    map: null,
    phase: 'idle',
    shoe: null,
    flashCards: [],
    steps: [],
    stepIndex: -1,
    flashMs: BASE_FLASH_MS,
    correctAnswer: 0,
    choices: [],
    selectedChoice: null,
    wasCorrect: null,
    streak: 0,
    rewardReady: false,
    questionsAnswered: 0,
    questionsCorrect: 0,
    xpAwarded: 0,
    levelUpNotice: null,

    startSession: (mapId) => {
      const map = mapById(mapId);
      if (!map) {
        return false;
      }
      clearAllTimers();
      set({
        sessionActive: true,
        map,
        phase: 'idle',
        shoe: quizShoe(),
        flashCards: [],
        steps: [],
        stepIndex: -1,
        flashMs: BASE_FLASH_MS,
        correctAnswer: 0,
        choices: [],
        selectedChoice: null,
        wasCorrect: null,
        streak: 0,
        rewardReady: false,
        questionsAnswered: 0,
        questionsCorrect: 0,
        xpAwarded: 0,
        levelUpNotice: null,
      });
      return true;
    },

    endSession: () => {
      clearAllTimers();
      set({
        sessionActive: false,
        map: null,
        phase: 'idle',
        shoe: null,
        flashCards: [],
        steps: [],
        stepIndex: -1,
        choices: [],
        selectedChoice: null,
        wasCorrect: null,
        levelUpNotice: null,
      });
    },

    startQuestion: () => {
      const { sessionActive, phase, rewardReady, streak } = get();
      if (!sessionActive || phase === 'flashing' || rewardReady) {
        return false;
      }

      const difficulty = quizDifficultyForStreak(streak);
      const totalCards = difficulty.cardCount + difficulty.decoyCount;

      let shoe = get().shoe ?? quizShoe();
      // Reshuffle silently when the shoe cannot cover the biggest question.
      const biggestQuestion =
        CARD_COUNTS[MAX_DIFFICULTY_STREAK] + quizDifficultyForStreak(MAX_DIFFICULTY_STREAK).decoyCount;
      if (cardsRemaining(shoe) < biggestQuestion) {
        shoe = quizShoe();
      }

      const cards: Card[] = [];
      for (let i = 0; i < totalCards; i++) {
        const result = draw(shoe, 'faceUp');
        shoe = result.shoe;
        cards.push(result.card);
      }
      const flashCards = buildFlashCards(cards, difficulty.decoyCount);
      const steps = buildFlashSteps(flashCards, difficulty.pairFlash);
      const correct = quizCorrectAnswer(flashCards);

      set({
        shoe,
        flashCards,
        steps,
        stepIndex: 0,
        flashMs: difficulty.flashMs,
        correctAnswer: correct,
        choices: buildCountChoices(correct),
        selectedChoice: null,
        wasCorrect: null,
        phase: 'flashing',
        xpAwarded: 0,
      });
      schedule(advanceFlash, stepDelay());
      return true;
    },

    answer: (choice) => {
      const { phase, correctAnswer, streak } = get();
      if (phase !== 'question') {
        return false;
      }
      const correct = choice === correctAnswer;
      const newStreak = correct ? Math.min(QUIZ_STREAK_TARGET, streak + 1) : 0;

      useModeStatsStore.getState().recordQuizAnswer(correct, newStreak);

      let xpAwarded = 0;
      let levelUpNotice: LevelUpNotice | null = null;
      if (correct) {
        xpAwarded = XP_AWARDS.quizCorrect;
        const outcome = awardXpWithRewards(xpAwarded);
        if (outcome.progression.levelsGained > 0) {
          levelUpNotice = {
            level: outcome.progression.newLevel,
            chipReward: outcome.progression.chipReward,
          };
        }
      }

      set({
        phase: 'feedback',
        selectedChoice: choice,
        wasCorrect: correct,
        streak: newStreak,
        rewardReady: newStreak >= QUIZ_STREAK_TARGET,
        questionsAnswered: get().questionsAnswered + 1,
        questionsCorrect: get().questionsCorrect + (correct ? 1 : 0),
        xpAwarded,
        levelUpNotice: levelUpNotice ?? get().levelUpNotice,
      });
      return correct;
    },

    claimGrandPrize: () => {
      if (!get().rewardReady) {
        return false;
      }
      useEconomyStore.getState().creditChips(QUIZ_GRAND_PRIZE_CHIPS);
      useModeStatsStore.getState().recordQuizCycleReward(QUIZ_GRAND_PRIZE_CHIPS);
      set({ rewardReady: false, streak: 0 });
      return true;
    },

    dismissLevelUp: () => set({ levelUpNotice: null }),
  };
});
