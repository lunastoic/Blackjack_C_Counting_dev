import { create } from 'zustand';
import { HandResult } from '../engine/blackjack/resolve';
import { QuizStats, RegularStats, SaveData } from '../persistence/schema';

/**
 * Persisted per-mode statistics (save schema v2). Regular Mode hands are
 * recorded by the game session store at settlement; Quiz Mode answers are
 * recorded by the quiz session store. Training Mode intentionally records
 * nothing here — it feeds the lifetime/achievement stats only.
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

interface ModeStatsState {
  readonly regular: RegularStats;
  readonly quiz: QuizStats;
  recordRegularHand(result: HandResult, profit: number): void;
  recordQuizAnswer(correct: boolean, streakAfter: number): void;
  recordQuizCycleReward(chips: number): void;
  hydrate(data: SaveData['modeStats']): void;
}

export const useModeStatsStore = create<ModeStatsState>()((set) => ({
  regular: INITIAL_REGULAR,
  quiz: INITIAL_QUIZ,

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

  hydrate: (data) => set({ regular: { ...data.regular }, quiz: { ...data.quiz } }),
}));
