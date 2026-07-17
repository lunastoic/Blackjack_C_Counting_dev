import { create } from 'zustand';
import { HandResult } from '../engine/blackjack/resolve';
import { LearnStats, QuizStats, RegularStats, SaveData } from '../persistence/schema';

/**
 * Persisted per-mode statistics (save schema v2, Learn checks in v5). Table
 * hands are recorded by the game session store at settlement; Quiz answers by
 * the quiz session store; Learn count-check answers by the game session store
 * when the Count Coach is set to Learn.
 */

const INITIAL_REGULAR: RegularStats = {
  handsPlayed: 0,
  wins: 0,
  pushes: 0,
  losses: 0,
  blackjacks: 0,
  netChips: 0,
};

const INITIAL_QUIZ: QuizStats = {
  questionsAnswered: 0,
  questionsCorrect: 0,
  bestStreak: 0,
  cyclesCompleted: 0,
  chipsEarned: 0,
};

const INITIAL_LEARN: LearnStats = {
  checksAsked: 0,
  checksCorrect: 0,
  bestStreak: 0,
};

interface ModeStatsState {
  readonly regular: RegularStats;
  readonly quiz: QuizStats;
  readonly learn: LearnStats;
  recordRegularHand(result: HandResult, profit: number): void;
  recordQuizAnswer(correct: boolean, streakAfter: number): void;
  recordQuizCycleReward(chips: number): void;
  recordLearnCheck(correct: boolean, streakAfter: number): void;
  hydrate(data: SaveData['modeStats']): void;
}

export const useModeStatsStore = create<ModeStatsState>()((set) => ({
  regular: INITIAL_REGULAR,
  quiz: INITIAL_QUIZ,
  learn: INITIAL_LEARN,

  recordRegularHand: (result, profit) =>
    set((state) => ({
      regular: {
        handsPlayed: state.regular.handsPlayed + 1,
        wins:
          result === 'win' || result === 'blackjack' ? state.regular.wins + 1 : state.regular.wins,
        pushes: result === 'push' ? state.regular.pushes + 1 : state.regular.pushes,
        losses: result === 'loss' ? state.regular.losses + 1 : state.regular.losses,
        blackjacks: result === 'blackjack' ? state.regular.blackjacks + 1 : state.regular.blackjacks,
        netChips: state.regular.netChips + profit,
      },
    })),

  recordQuizAnswer: (correct, streakAfter) =>
    set((state) => ({
      quiz: {
        ...state.quiz,
        questionsAnswered: state.quiz.questionsAnswered + 1,
        questionsCorrect: correct ? state.quiz.questionsCorrect + 1 : state.quiz.questionsCorrect,
        bestStreak: Math.max(state.quiz.bestStreak, streakAfter),
      },
    })),

  recordQuizCycleReward: (chips) =>
    set((state) => ({
      quiz: {
        ...state.quiz,
        cyclesCompleted: state.quiz.cyclesCompleted + 1,
        chipsEarned: state.quiz.chipsEarned + chips,
      },
    })),

  recordLearnCheck: (correct, streakAfter) =>
    set((state) => ({
      learn: {
        checksAsked: state.learn.checksAsked + 1,
        checksCorrect: correct ? state.learn.checksCorrect + 1 : state.learn.checksCorrect,
        bestStreak: Math.max(state.learn.bestStreak, streakAfter),
      },
    })),

  hydrate: (data) =>
    set({ regular: { ...data.regular }, quiz: { ...data.quiz }, learn: { ...data.learn } }),
}));
