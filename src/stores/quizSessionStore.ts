import { create } from 'zustand';
import { CasinoMap, mapById } from '../engine/betting/casino';
import { Card } from '../engine/cards/card';
import { applyVisibleCards } from '../engine/counting/hiLo';
import { XP_AWARDS } from '../engine/progression/progression';
import { cardsRemaining, createShoe, DeckCount, draw, Shoe } from '../engine/shoe/shoe';
import { useEconomyStore } from './economyStore';
import { useModeStatsStore } from './modeStatsStore';
import { useSettingsStore } from './settingsStore';
import { awardXpWithRewards } from './orchestration';
import { LevelUpNotice } from './gameSessionStore';

/**
 * Quiz Mode (REBUILD_SPEC §11): 3–7 random cards flash one at a time, then
 * "What was the count?" with 4 multiple-choice answers. Correct answers pay
 * 3 XP and fill 1 of 9 progress circles; a wrong answer resets the streak;
 * 9 in a row lets the player claim 250 chips. No bets are at stake.
 *
 * Cards come from a real shoe (quiz deck-count setting) so streaks quiz the
 * same distribution the tables use; the shoe reshuffles silently when low.
 */

export const QUIZ_STREAK_TARGET = 9;
export const QUIZ_STREAK_REWARD_CHIPS = 250;
export const QUIZ_MIN_CARDS = 3;
export const QUIZ_MAX_CARDS = 7;

export type QuizPhase = 'idle' | 'flashing' | 'question' | 'feedback';

interface QuizSessionState {
  readonly sessionActive: boolean;
  readonly map: CasinoMap | null;
  readonly phase: QuizPhase;
  readonly shoe: Shoe | null;
  /** Cards in the current question, in flash order. */
  readonly cards: readonly Card[];
  /** Index of the card currently displayed while flashing (−1 = none yet). */
  readonly flashIndex: number;
  readonly correctAnswer: number;
  /** Four multiple-choice options (always contains correctAnswer). */
  readonly choices: readonly number[];
  readonly selectedChoice: number | null;
  readonly wasCorrect: boolean | null;
  /** Progress circles: 0…9 consecutive correct answers. */
  readonly streak: number;
  /** True once the streak hits 9 — the reward is claimable. */
  readonly rewardReady: boolean;
  readonly questionsAnswered: number;
  readonly questionsCorrect: number;
  readonly xpAwarded: number;
  readonly levelUpNotice: LevelUpNotice | null;

  startSession(mapId: number): boolean;
  endSession(): void;
  startQuestion(): boolean;
  answer(choice: number): boolean;
  claimStreakReward(): boolean;
  dismissLevelUp(): void;
}

const FLASH_MS = 800;

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

function flashDelay(): number {
  // Reduced motion does not shorten the rhythm — cards simply appear without
  // motion — the reading pace must stay comfortable either way.
  const { dealerSpeed } = useSettingsStore.getState();
  return Math.round(FLASH_MS / dealerSpeed);
}

function quizShoe(): Shoe {
  const deckCount: DeckCount = useSettingsStore.getState().deckCounts.quiz;
  return createShoe(deckCount);
}

/** 4 unique choices including the answer, shuffled. */
export function buildChoices(
  correct: number,
  random: () => number = Math.random,
): number[] {
  const options = new Set<number>([correct]);
  // Offsets close to the answer make the quiz meaningfully hard.
  const candidateOffsets = [-3, -2, -1, 1, 2, 3, 4, -4];
  while (options.size < 4 && candidateOffsets.length > 0) {
    const index = Math.floor(random() * candidateOffsets.length);
    const [offset] = candidateOffsets.splice(index, 1);
    options.add(correct + offset);
  }
  const list = [...options];
  // Fisher–Yates shuffle so the correct answer's position is random.
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export const useQuizSessionStore = create<QuizSessionState>()((set, get) => {
  function advanceFlash(): void {
    const { phase, flashIndex, cards } = get();
    if (phase !== 'flashing') {
      return;
    }
    const next = flashIndex + 1;
    if (next < cards.length) {
      set({ flashIndex: next });
      schedule(advanceFlash, flashDelay());
    } else {
      set({ phase: 'question', flashIndex: -1 });
    }
  }

  return {
    sessionActive: false,
    map: null,
    phase: 'idle',
    shoe: null,
    cards: [],
    flashIndex: -1,
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
        cards: [],
        flashIndex: -1,
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
        cards: [],
        flashIndex: -1,
        choices: [],
        selectedChoice: null,
        wasCorrect: null,
        levelUpNotice: null,
      });
    },

    startQuestion: () => {
      const { sessionActive, phase, rewardReady } = get();
      if (!sessionActive || phase === 'flashing' || rewardReady) {
        return false;
      }

      let shoe = get().shoe ?? quizShoe();
      const cardCount =
        QUIZ_MIN_CARDS + Math.floor(Math.random() * (QUIZ_MAX_CARDS - QUIZ_MIN_CARDS + 1));
      // Reshuffle silently when the shoe cannot cover the biggest question.
      if (cardsRemaining(shoe) < QUIZ_MAX_CARDS) {
        shoe = quizShoe();
      }

      const cards: Card[] = [];
      for (let i = 0; i < cardCount; i++) {
        const result = draw(shoe, 'faceUp');
        shoe = result.shoe;
        cards.push(result.card);
      }
      const correct = applyVisibleCards({ runningCount: 0 }, cards).runningCount;

      set({
        shoe,
        cards,
        flashIndex: 0,
        correctAnswer: correct,
        choices: buildChoices(correct),
        selectedChoice: null,
        wasCorrect: null,
        phase: 'flashing',
        xpAwarded: 0,
      });
      schedule(advanceFlash, flashDelay());
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

    claimStreakReward: () => {
      if (!get().rewardReady) {
        return false;
      }
      useEconomyStore.getState().creditChips(QUIZ_STREAK_REWARD_CHIPS);
      useModeStatsStore.getState().recordQuizCycleReward(QUIZ_STREAK_REWARD_CHIPS);
      set({ rewardReady: false, streak: 0 });
      return true;
    },

    dismissLevelUp: () => set({ levelUpNotice: null }),
  };
});
