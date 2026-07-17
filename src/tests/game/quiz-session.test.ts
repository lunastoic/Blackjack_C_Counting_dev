import { Card, hiLoValue } from '../../engine/cards/card';
import { createDefaultSave } from '../../persistence/defaults';
import { useEconomyStore } from '../../stores/economyStore';
import { useModeStatsStore } from '../../stores/modeStatsStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  buildChoices,
  buildFlashCards,
  buildFlashSteps,
  QUIZ_GRAND_PRIZE_CHIPS,
  QUIZ_STREAK_TARGET,
  quizCorrectAnswer,
  quizDifficultyForStreak,
  useQuizSessionStore,
} from '../../stores/quizSessionStore';

/**
 * Quiz Mode (count sprint): fast flash flow, streak-driven difficulty,
 * face-down decoys, scoring, the 9-circle grand prize, and persisted stats.
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
    deckCounts: { regular: 6, quiz: 1 },
  });
}

/** Runs the flashing phase to completion and returns the question state. */
function flashThrough(): void {
  expect(quiz().startQuestion()).toBe(true);
  expect(quiz().phase).toBe('flashing');
  // Worst case: 12 steps at the slowest 750ms pace.
  jest.advanceTimersByTime(12 * 800 + 100);
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

  it('flashes the streak-0 load (7 cards, no decoys), then asks the question', () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().startQuestion()).toBe(true);

    const state = quiz();
    expect(state.phase).toBe('flashing');
    expect(state.flashCards).toHaveLength(7);
    expect(state.flashCards.every((item) => !item.faceDown)).toBe(true);
    expect(state.steps.flat()).toHaveLength(7);
    expect(state.stepIndex).toBe(0);
    expect(state.flashMs).toBe(750);

    // Each step holds for ~750ms at 1.0× speed.
    jest.advanceTimersByTime(750);
    expect(quiz().stepIndex === 1 || quiz().phase === 'question').toBe(true);

    jest.advanceTimersByTime(12 * 800);
    expect(quiz().phase).toBe('question');
    expect(quiz().choices).toHaveLength(4);
    expect(quiz().choices).toContain(quiz().correctAnswer);
  });

  it('computes the correct Hi-Lo answer for the flashed cards', () => {
    expect(quiz().startSession(1)).toBe(true);
    flashThrough();
    const expected = quiz().flashCards.reduce(
      (sum, item) => (item.faceDown ? sum : sum + hiLoValue(item.card.rank)),
      0,
    );
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

describe('difficulty ramp', () => {
  it('scales cards, speed, and decoys with the streak', () => {
    const easy = quizDifficultyForStreak(0);
    expect(easy).toEqual({ cardCount: 7, decoyCount: 0, flashMs: 750, pairFlash: false });

    const mid = quizDifficultyForStreak(4);
    expect(mid.cardCount).toBe(8);
    expect(mid.decoyCount).toBe(1);
    expect(mid.flashMs).toBeLessThan(easy.flashMs);

    const top = quizDifficultyForStreak(8);
    expect(top).toEqual({ cardCount: 10, decoyCount: 2, flashMs: 390, pairFlash: true });

    // Clamped outside the 9-circle range.
    expect(quizDifficultyForStreak(-1)).toEqual(easy);
    expect(quizDifficultyForStreak(99)).toEqual(top);
  });

  it('mixes in decoys once the streak reaches 3', () => {
    expect(quiz().startSession(1)).toBe(true);
    for (let i = 0; i < 3; i++) {
      answerCorrectly();
    }
    expect(quiz().streak).toBe(3);
    flashThrough();
    expect(quiz().flashCards.filter((item) => item.faceDown)).toHaveLength(1);
    expect(quiz().flashCards).toHaveLength(9); // 8 counting cards + 1 decoy
  });

  it('face-down decoys never move the correct answer', () => {
    const cards = [
      { rank: '5', suit: 'hearts', id: 'a', visibility: 'faceUp' },
      { rank: 'K', suit: 'spades', id: 'b', visibility: 'faceUp' },
      { rank: '9', suit: 'clubs', id: 'c', visibility: 'faceUp' },
    ] as unknown as Card[];
    // Force the decoy onto the king (index 1) via a rigged random sequence.
    const flashCards = buildFlashCards(cards, 1, () => 1 / 3 + 0.01);
    expect(flashCards[1].faceDown).toBe(true);
    expect(quizCorrectAnswer(flashCards)).toBe(hiLoValue('5' as Card['rank'])); // +1, king ignored
  });

  it('pairs neighbors when pair flashing is on', () => {
    const cards = Array.from({ length: 6 }, (_, i) => ({
      rank: '5',
      suit: 'hearts',
      id: `c${i}`,
      visibility: 'faceUp',
    })) as unknown as Card[];
    const flashCards = buildFlashCards(cards, 0);
    const paired = buildFlashSteps(flashCards, true, () => 0); // always pair
    expect(paired.every((step) => step.length === 2)).toBe(true);
    expect(paired.flat()).toHaveLength(6);

    const solo = buildFlashSteps(flashCards, false, () => 0);
    expect(solo.every((step) => step.length === 1)).toBe(true);
  });
});

describe('scoring, streaks, and XP', () => {
  it('pays 3 XP and fills a golden circle on a correct answer', () => {
    expect(quiz().startSession(1)).toBe(true);
    answerCorrectly();

    expect(quiz().wasCorrect).toBe(true);
    expect(quiz().streak).toBe(1);
    expect(quiz().xpAwarded).toBe(3);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(3);
    expect(useModeStatsStore.getState().quiz.questionsCorrect).toBe(1);
  });

  it('resets the circles (but not stats) on a wrong answer', () => {
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

  it('awards the grand prize after 9 in a row, then restarts the circles', () => {
    expect(quiz().startSession(1)).toBe(true);
    for (let i = 0; i < QUIZ_STREAK_TARGET; i++) {
      answerCorrectly();
    }
    expect(quiz().rewardReady).toBe(true);
    expect(quiz().startQuestion()).toBe(false); // must claim first

    const before = useEconomyStore.getState().chips;
    expect(quiz().claimGrandPrize()).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(before + QUIZ_GRAND_PRIZE_CHIPS);
    expect(quiz().streak).toBe(0);
    expect(quiz().rewardReady).toBe(false);
    expect(quiz().claimGrandPrize()).toBe(false); // no double claims

    const stats = useModeStatsStore.getState().quiz;
    expect(stats.cyclesCompleted).toBe(1);
    expect(stats.chipsEarned).toBe(QUIZ_GRAND_PRIZE_CHIPS);
    expect(stats.bestStreak).toBe(QUIZ_STREAK_TARGET);
  });

  it('reshuffles the shoe silently instead of running out of cards', () => {
    expect(quiz().startSession(1)).toBe(true);
    // 52-card shoe / up to 12 cards per question: 12 questions guarantee
    // several internal reshuffles without ever failing to start.
    for (let i = 0; i < 12; i++) {
      answerCorrectly();
      if (quiz().rewardReady) {
        quiz().claimGrandPrize();
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
    expect(state.flashCards).toHaveLength(0);
    expect(state.steps).toHaveLength(0);
    expect(state.phase).toBe('idle');
    // Persisted stats survive the session.
    expect(useModeStatsStore.getState().quiz.questionsAnswered).toBe(1);
  });
});
