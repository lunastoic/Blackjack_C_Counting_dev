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
  QUIZ_MAX_RIDE_MULTIPLIER,
  QUIZ_STREAK_TARGET,
  quizCheckpointForStreak,
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
  // Worst case: 12 steps at the slowest pace (750ms × Luna Luxe's 1.5×).
  jest.advanceTimersByTime(12 * 1200 + 100);
  expect(quiz().phase).toBe('question');
}

function answerCorrectly(): void {
  flashThrough();
  expect(quiz().answer(quiz().correctAnswer)).toBe(true);
}

/** Climbs the streak to `target` correct answers in a row. */
function buildStreak(target: number): void {
  while (quiz().streak < target) {
    answerCorrectly();
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStores();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('session and question flow', () => {
  it("starts on a valid map with that casino's shoe", () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().shoe?.deckCount).toBe(1); // Luna Luxe deals a single deck
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
    // 750ms base × Luna Luxe's 1.5× training pace.
    expect(state.flashMs).toBe(1125);

    // Each step holds for ~1125ms at 1.0× dealer speed.
    jest.advanceTimersByTime(1125);
    expect(quiz().stepIndex === 1 || quiz().phase === 'question').toBe(true);

    jest.advanceTimersByTime(12 * 1200);
    expect(quiz().phase).toBe('question');
    expect(quiz().choices).toHaveLength(4);
    expect(quiz().choices).toContain(quiz().correctAnswer);
  });

  it('paces the flash by casino: Luna Luxe slowest, Kepler full speed', () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().flashMs).toBe(1125); // 750 × 1.5 before the first question
    expect(quiz().startQuestion()).toBe(true);
    expect(quiz().flashMs).toBe(1125);
    quiz().endSession();

    expect(quiz().startSession(6)).toBe(true); // Kepler Fortune
    expect(quiz().startQuestion()).toBe(true);
    expect(quiz().flashMs).toBe(750); // raw near-dealer pace
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
  it('scales cards, speed, decoys, and XP with the streak', () => {
    const easy = quizDifficultyForStreak(0);
    expect(easy).toEqual({
      cardCount: 7,
      decoyCount: 0,
      flashMs: 750,
      pairFlash: false,
      xpReward: 3,
      cardSkin: 'training',
      underglow: true,
    });

    const mid = quizDifficultyForStreak(4);
    expect(mid.cardCount).toBe(8);
    expect(mid.decoyCount).toBe(1);
    expect(mid.flashMs).toBeLessThan(easy.flashMs);
    expect(mid.xpReward).toBe(4);
    expect(quizDifficultyForStreak(6).xpReward).toBe(5);

    const top = quizDifficultyForStreak(8);
    expect(top).toEqual({
      cardCount: 10,
      decoyCount: 2,
      flashMs: 390,
      pairFlash: true,
      xpReward: 6,
      cardSkin: 'regular',
      underglow: false,
    });

    // Clamped outside the 9-circle range.
    expect(quizDifficultyForStreak(-1)).toEqual(easy);
    expect(quizDifficultyForStreak(99)).toEqual(top);
  });

  it('peels the counting aids away tier by tier', () => {
    // Circles 1–3: training faces with the Hi-Lo glow.
    expect(quizDifficultyForStreak(0).cardSkin).toBe('training');
    expect(quizDifficultyForStreak(2).underglow).toBe(true);
    // Circles 4–6: regular faces, glow stays.
    expect(quizDifficultyForStreak(3).cardSkin).toBe('regular');
    expect(quizDifficultyForStreak(5).underglow).toBe(true);
    // Circles 7–9: regular faces, no glow.
    expect(quizDifficultyForStreak(6).cardSkin).toBe('regular');
    expect(quizDifficultyForStreak(6).underglow).toBe(false);
    expect(quizDifficultyForStreak(8).underglow).toBe(false);
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

  it('resets the circles (but not stats) on a wrong answer below the first checkpoint', () => {
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

  it('pays the tier XP at high streaks', () => {
    expect(quiz().startSession(1)).toBe(true);
    buildStreak(3);
    answerCorrectly(); // answered at streak 3 → tier-1 reward
    expect(quiz().xpAwarded).toBe(4);

    buildStreak(8);
    answerCorrectly(); // answered at streak 8 → top-tier reward
    expect(quiz().xpAwarded).toBe(6);
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

describe('checkpoints', () => {
  it('maps streaks to their checkpoint floor', () => {
    expect(quizCheckpointForStreak(0)).toBe(0);
    expect(quizCheckpointForStreak(2)).toBe(0);
    expect(quizCheckpointForStreak(3)).toBe(3);
    expect(quizCheckpointForStreak(5)).toBe(3);
    expect(quizCheckpointForStreak(6)).toBe(6);
    expect(quizCheckpointForStreak(8)).toBe(6);
  });

  it('drops a miss back to the checkpoint, not to zero', () => {
    expect(quiz().startSession(1)).toBe(true);
    buildStreak(4);
    flashThrough();
    expect(quiz().answer(quiz().correctAnswer + 1)).toBe(false);
    expect(quiz().streak).toBe(3);

    buildStreak(7);
    flashThrough();
    expect(quiz().answer(quiz().correctAnswer + 1)).toBe(false);
    expect(quiz().streak).toBe(6);
  });
});

describe('let it ride', () => {
  function completeCycle(): void {
    buildStreak(QUIZ_STREAK_TARGET);
    expect(quiz().rewardReady).toBe(true);
  }

  it('doubles the pot instead of banking it, then pays out the ridden pot', () => {
    expect(quiz().startSession(1)).toBe(true);
    completeCycle();

    expect(quiz().letItRide()).toBe(true);
    expect(quiz().rewardReady).toBe(false);
    expect(quiz().streak).toBe(0);
    expect(quiz().prizeMultiplier).toBe(2);
    // The ridden cycle counts as completed with 0 chips banked.
    expect(useModeStatsStore.getState().quiz.cyclesCompleted).toBe(1);
    expect(useModeStatsStore.getState().quiz.chipsEarned).toBe(0);

    completeCycle();
    const before = useEconomyStore.getState().chips;
    expect(quiz().claimGrandPrize()).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(before + 2 * QUIZ_GRAND_PRIZE_CHIPS);
    expect(quiz().prizeMultiplier).toBe(1);
    expect(useModeStatsStore.getState().quiz.cyclesCompleted).toBe(2);
    expect(useModeStatsStore.getState().quiz.chipsEarned).toBe(2 * QUIZ_GRAND_PRIZE_CHIPS);
  });

  it('loses the riding pot on any miss', () => {
    expect(quiz().startSession(1)).toBe(true);
    completeCycle();
    expect(quiz().letItRide()).toBe(true);

    flashThrough();
    expect(quiz().answer(quiz().correctAnswer + 1)).toBe(false);
    expect(quiz().prizeMultiplier).toBe(1);
    expect(quiz().rideLost).toBe(true);

    // The flag clears as soon as the next question starts.
    flashThrough();
    expect(quiz().rideLost).toBe(false);
  });

  it('refuses to ride without a ready prize or past the multiplier cap', () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().letItRide()).toBe(false); // nothing to ride yet

    useQuizSessionStore.setState({
      rewardReady: true,
      prizeMultiplier: QUIZ_MAX_RIDE_MULTIPLIER,
    });
    expect(quiz().letItRide()).toBe(false); // capped at ×8
    expect(quiz().claimGrandPrize()).toBe(true); // banking still works
    expect(quiz().prizeMultiplier).toBe(1);
  });
});

describe('manual advance', () => {
  it('stays on the feedback screen until the player starts the next question', () => {
    expect(quiz().startSession(1)).toBe(true);

    // After a correct answer…
    answerCorrectly();
    expect(quiz().phase).toBe('feedback');
    jest.advanceTimersByTime(60_000);
    expect(quiz().phase).toBe('feedback'); // no auto-advance, ever

    // …after a miss…
    flashThrough();
    expect(quiz().answer(quiz().correctAnswer + 1)).toBe(false);
    jest.advanceTimersByTime(60_000);
    expect(quiz().phase).toBe('feedback');

    // …and at the prize screen.
    buildStreak(QUIZ_STREAK_TARGET);
    expect(quiz().rewardReady).toBe(true);
    jest.advanceTimersByTime(60_000);
    expect(quiz().phase).toBe('feedback');

    // "Next cards" (startQuestion) is the only way forward.
    expect(quiz().claimGrandPrize()).toBe(true);
    expect(quiz().startQuestion()).toBe(true);
    expect(quiz().phase).toBe('flashing');
  });
});

describe('table licenses (quiz-first progression)', () => {
  it('grants a permit at 3 in a row and the full license at 9', () => {
    const progression = useProgressionStore.getState();
    expect(quiz().startSession(1)).toBe(true);
    expect(progression.licenseForMap(1)).toBe('none');

    buildStreak(3);
    expect(useProgressionStore.getState().licenseForMap(1)).toBe('permit');
    expect(quiz().licenseEarned).toBe('permit');

    buildStreak(QUIZ_STREAK_TARGET);
    expect(useProgressionStore.getState().licenseForMap(1)).toBe('licensed');
    expect(quiz().licenseEarned).toBe('licensed');
  });

  it('licenses are per casino and never re-announced or downgraded', () => {
    expect(quiz().startSession(1)).toBe(true);
    buildStreak(QUIZ_STREAK_TARGET);
    expect(quiz().claimGrandPrize()).toBe(true);

    // A second run over the same milestones announces nothing new.
    buildStreak(3);
    expect(quiz().licenseEarned).toBeNull();
    expect(useProgressionStore.getState().licenseForMap(1)).toBe('licensed');

    // Other casinos still need their own sprint.
    expect(useProgressionStore.getState().licenseForMap(2)).toBe('none');
  });

  it('deals the quiz from the casino shoe (Luna Luxe 1 deck, Kepler 8)', () => {
    expect(quiz().startSession(1)).toBe(true);
    expect(quiz().shoe?.deckCount).toBe(1);
    quiz().endSession();
    expect(quiz().startSession(6)).toBe(true);
    expect(quiz().shoe?.deckCount).toBe(8);
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
