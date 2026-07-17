import { hiLoValue } from '../../engine/cards/card';
import { createDefaultSave } from '../../persistence/defaults';
import { useEconomyStore } from '../../stores/economyStore';
import { useModeStatsStore } from '../../stores/modeStatsStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  buildChoices,
  QUIZ_MAX_CARDS,
  QUIZ_MIN_CARDS,
  QUIZ_STREAK_REWARD_CHIPS,
  QUIZ_STREAK_TARGET,
  useQuizSessionStore,
} from '../../stores/quizSessionStore';

/**
 * Quiz Mode: flash-card flow, scoring, streak circles, XP, the 9-in-a-row
 * chip reward, and persisted quiz statistics.
 */

function quiz() {
  return useQuizSessionStore.getState();
}

function resetStores(): void {
  quiz().endSession();
  const defaults = createDefaultSave();
  useEconomyStore.getState().hydrate(defaults.economy);
  useProgressionStore.getState().hydrate(defaults.progression);
  useModeStatsStore.getState().hydrate(defaults.modeStats);
  useSettingsStore.getState().hydrate({
    ...defaults.settings,
    deckCounts: { training: 1, regular: 6, quiz: 1 },
  });
}

/** Runs the flashing phase to completion and returns the question state. */
function flashThrough(): void {
  expect(quiz().startQuestion()).toBe(true);
  expect(quiz().phase).toBe('flashing');
  jest.advanceTimersByTime(QUIZ_MAX_CARDS * 800 + 100);
  expect(quiz().phase).toBe('question');
}

function answerCorrectly(): void {
  flashThrough();
  expect(quiz().answer(quiz().correctAnswer)).toBe(true);
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStores();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('session and question flow', () => {
  it('starts on a valid map with the quiz deck-count setting', () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().shoe?.deckCount).toBe(1);
    expect(quiz().phase).toBe('idle');
    expect(quiz().startSession(99)).toBe(false);
  });

  it('flashes 3–7 cards one at a time, then asks the question', () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().startQuestion()).toBe(true);

    const state = quiz();
    expect(state.phase).toBe('flashing');
    expect(state.cards.length).toBeGreaterThanOrEqual(QUIZ_MIN_CARDS);
    expect(state.cards.length).toBeLessThanOrEqual(QUIZ_MAX_CARDS);
    expect(state.flashIndex).toBe(0);

    // Each card holds for ~800ms at 1.0× speed.
    jest.advanceTimersByTime(800);
    expect(quiz().flashIndex === 1 || quiz().phase === 'question').toBe(true);

    jest.advanceTimersByTime(QUIZ_MAX_CARDS * 800);
    expect(quiz().phase).toBe('question');
    expect(quiz().choices).toHaveLength(4);
    expect(quiz().choices).toContain(quiz().correctAnswer);
  });

  it('computes the correct Hi-Lo answer for the flashed cards', () => {
    expect(quiz().startSession(1)).toBe(true);
    flashThrough();
    const expected = quiz().cards.reduce((sum, card) => sum + hiLoValue(card.rank), 0);
    expect(quiz().correctAnswer).toBe(expected);
  });

  it('ignores answers outside the question phase and double-answers', () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().answer(0)).toBe(false); // idle
    flashThrough();
    quiz().answer(quiz().correctAnswer);
    expect(quiz().phase).toBe('feedback');
    expect(quiz().answer(quiz().correctAnswer)).toBe(false); // already answered
  });
});

describe('scoring, streaks, and XP', () => {
  it('pays 3 XP and fills a streak circle on a correct answer', () => {
    expect(quiz().startSession(1)).toBe(true);
    answerCorrectly();

    expect(quiz().wasCorrect).toBe(true);
    expect(quiz().streak).toBe(1);
    expect(quiz().xpAwarded).toBe(3);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(3);
    expect(useModeStatsStore.getState().quiz.questionsCorrect).toBe(1);
  });

  it('resets the streak (but not stats) on a wrong answer', () => {
    expect(quiz().startSession(1)).toBe(true);
    answerCorrectly();
    expect(quiz().streak).toBe(1);

    flashThrough();
    // Deliberately wrong: one off from the real count.
    expect(quiz().answer(quiz().correctAnswer + 1)).toBe(false);
    expect(quiz().streak).toBe(0);
    expect(quiz().wasCorrect).toBe(false);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(3); // unchanged

    const stats = useModeStatsStore.getState().quiz;
    expect(stats.questionsAnswered).toBe(2);
    expect(stats.questionsCorrect).toBe(1);
    expect(stats.bestStreak).toBe(1); // best streak survives the miss
  });

  it('awards the 250-chip reward after 9 in a row, then restarts the circles', () => {
    expect(quiz().startSession(1)).toBe(true);
    for (let i = 0; i < QUIZ_STREAK_TARGET; i++) {
      answerCorrectly();
    }
    expect(quiz().rewardReady).toBe(true);
    expect(quiz().startQuestion()).toBe(false); // must claim first

    const before = useEconomyStore.getState().chips;
    expect(quiz().claimStreakReward()).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(before + QUIZ_STREAK_REWARD_CHIPS);
    expect(quiz().streak).toBe(0);
    expect(quiz().rewardReady).toBe(false);
    expect(quiz().claimStreakReward()).toBe(false); // no double claims

    const stats = useModeStatsStore.getState().quiz;
    expect(stats.cyclesCompleted).toBe(1);
    expect(stats.chipsEarned).toBe(QUIZ_STREAK_REWARD_CHIPS);
    expect(stats.bestStreak).toBe(QUIZ_STREAK_TARGET);
  });

  it('reshuffles the shoe silently instead of running out of cards', () => {
    expect(quiz().startSession(1)).toBe(true);
    // 52-card shoe / up to 7 cards per question: 12 questions guarantee at
    // least one internal reshuffle without ever failing to start.
    for (let i = 0; i < 12; i++) {
      answerCorrectly();
      if (quiz().rewardReady) {
        quiz().claimStreakReward();
      }
    }
    expect(useModeStatsStore.getState().quiz.questionsAnswered).toBe(12);
  });
});

describe('choice generation', () => {
  it('always returns 4 unique options containing the answer', () => {
    for (let answer = -8; answer <= 8; answer++) {
      const choices = buildChoices(answer);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(answer);
    }
  });
});

describe('session cleanup', () => {
  it('clears transient state on endSession', () => {
    expect(quiz().startSession(1)).toBe(true);
    answerCorrectly();
    quiz().endSession();

    const state = quiz();
    expect(state.sessionActive).toBe(false);
    expect(state.cards).toHaveLength(0);
    expect(state.phase).toBe('idle');
    // Persisted stats survive the session.
    expect(useModeStatsStore.getState().quiz.questionsAnswered).toBe(1);
  });
});
