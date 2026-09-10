import { Rank } from '../../engine/cards/card';
import { cardsOf, riggedShoe } from '../../engine/testing/fixtures';
import { createDefaultSave } from '../../persistence/defaults';
import { useAchievementStore } from '../../stores/achievementStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useModeStatsStore } from '../../stores/modeStatsStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * The coach's automatic post-round Count Check. Shipped OFF
 * (`FEATURES.autoCountChecks`); these tests run it with the flag on so the
 * cadence engine keeps working for the day it comes back.
 */
jest.mock('../../constants/features', () => {
  const actual = jest.requireActual<typeof import('../../constants/features')>(
    '../../constants/features',
  );
  return { FEATURES: { ...actual.FEATURES, autoCountChecks: true } };
});

function resetStores(chips = 500): void {
  useGameSessionStore.getState().endSession();
  const defaults = createDefaultSave();
  useEconomyStore.getState().hydrate({ ...defaults.economy, chips });
  useProgressionStore.getState().hydrate({
    ...defaults.progression,
    unlockedMapIds: [1, 2, 3],
    licenses: { '1': 'licensed', '2': 'licensed', '3': 'licensed' },
  });
  useAchievementStore.getState().hydrate(defaults.achievements, defaults.mapAchievements);
  useModeStatsStore.getState().hydrate(defaults.modeStats);
  useSettingsStore.getState().hydrate({
    ...defaults.settings,
    deckCounts: { regular: 1, quiz: 1 },
  });
}

function rig(...ranks: Rank[]): void {
  const filler = Array.from({ length: 30 }, () => '7' as Rank);
  useGameSessionStore.setState({ shoe: riggedShoe(cardsOf(...ranks, ...filler), 1) });
}

function session() {
  return useGameSessionStore.getState();
}

/** Deal → stand → settle a rigged winning hand (19 vs dealer 18). */
function playWinningRound(): void {
  rig('10', '10', '9', '8');
  expect(session().addChipToBet(100)).toBe(true);
  expect(session().deal()).toBe(true);
  jest.advanceTimersByTime(3500);
  expect(session().act('stand')).toBe(true);
  jest.runAllTimers();
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStores();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Training Mode on: no count checks', () => {
  it('never pops a post-round check', () => {
    useSettingsStore.getState().setTrainingMode(true);
    expect(session().startSession(1)).toBe(true);
    playWinningRound();
    expect(session().countCheck).toBeNull();
  });
});

describe('Learn coach count checks (Training Mode off)', () => {
  beforeEach(() => {
    useSettingsStore.getState().setTrainingMode(false);
    useSettingsStore.getState().setCountCoachLevel('learn');
    expect(session().startSession(1)).toBe(true);
  });

  it('pops a count check after the first round with the true running count', () => {
    playWinningRound();

    const check = session().countCheck;
    expect(check).not.toBeNull();
    expect(check!.kind).toBe('running');
    // 10, 10, 9, 8 → −1 −1 0 0 = −2.
    expect(check!.correct).toBe(-2);
    expect(check!.runningCount).toBe(-2);
    expect(check!.choices).toHaveLength(4);
    expect(check!.choices).toContain(-2);
    expect(check!.selected).toBeNull();
  });

  it('correct answers pay 3 XP, build the streak, and stretch the cadence', () => {
    playWinningRound();
    const xpAfterRound = useProgressionStore.getState().xpIntoLevel; // hand XP
    expect(session().answerCountCheck(session().countCheck!.correct)).toBe(true);
    expect(session().countCheck!.wasCorrect).toBe(true);
    expect(session().learnStreak).toBe(1);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(xpAfterRound + 3);
    expect(useModeStatsStore.getState().learn).toEqual({
      checksAsked: 1,
      checksCorrect: 1,
      bestStreak: 1,
    });
    session().dismissCountCheck();
    expect(session().countCheck).toBeNull();

    // Two more correct answers → streak 3 → the coach skips a round.
    for (let i = 0; i < 2; i++) {
      playWinningRound();
      expect(session().countCheck).not.toBeNull();
      session().answerCountCheck(session().countCheck!.correct);
      session().dismissCountCheck();
    }
    expect(session().learnStreak).toBe(3);

    playWinningRound();
    expect(session().countCheck).toBeNull(); // skipped (interval is now 2)
    playWinningRound();
    expect(session().countCheck).not.toBeNull(); // due again
  });

  it('a wrong answer resets the streak and awards nothing', () => {
    playWinningRound();
    const xpAfterRound = useProgressionStore.getState().xpIntoLevel; // hand XP only
    const check = session().countCheck!;
    expect(session().answerCountCheck(check.correct + 1)).toBe(false);
    expect(session().countCheck!.wasCorrect).toBe(false);
    expect(session().learnStreak).toBe(0);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(xpAfterRound);
    expect(useModeStatsStore.getState().learn.checksAsked).toBe(1);
    expect(useModeStatsStore.getState().learn.checksCorrect).toBe(0);
    // Double answers are ignored.
    expect(session().answerCountCheck(check.correct)).toBe(false);
  });

  it('checks only pop under Learn — Off and Full never interrupt, whatever the Training switch says', () => {
    for (const level of ['off', 'full'] as const) {
      for (const trainingMode of [false, true]) {
        resetStores();
        useSettingsStore.getState().setTrainingMode(trainingMode);
        useSettingsStore.getState().setCountCoachLevel(level);
        expect(session().startSession(1)).toBe(true);
        playWinningRound();
        expect(session().countCheck).toBeNull();
      }
    }
    resetStores();
    useSettingsStore.getState().setTrainingMode(true);
    useSettingsStore.getState().setCountCoachLevel('learn');
    expect(session().startSession(1)).toBe(true);
    playWinningRound();
    expect(session().countCheck).not.toBeNull();
  });
});

describe('Learn fog-of-war meter driven by coach checks', () => {
  beforeEach(() => {
    useSettingsStore.getState().setTrainingMode(false);
    useSettingsStore.getState().setCountCoachLevel('learn');
    expect(session().startSession(1)).toBe(true);
  });

  it('climbs a tier per correct check (capped at 2) and falls on a miss', () => {
    expect(session().revealTier).toBe(0);

    playWinningRound();
    session().answerCountCheck(session().countCheck!.correct);
    session().dismissCountCheck();
    expect(session().revealTier).toBe(1); // running count revealed

    playWinningRound();
    session().answerCountCheck(session().countCheck!.correct);
    session().dismissCountCheck();
    expect(session().revealTier).toBe(2); // true count revealed

    // A miss fogs one tier back.
    useGameSessionStore.setState({ learnStreak: 0 }); // check due next round
    playWinningRound();
    session().answerCountCheck(session().countCheck!.correct + 1);
    expect(session().revealTier).toBe(1);
  });

  it('a shuffle fogs the meter, and shuffle-boundary checks never unlock tiers', () => {
    useGameSessionStore.setState({ revealTier: 2 });

    // 10-card shoe passes the cut card during the round → shuffle after it.
    const ranks: Rank[] = ['10', '5', '9', '8', ...Array.from({ length: 6 }, () => '2' as Rank)];
    useGameSessionStore.setState({ shoe: riggedShoe(cardsOf(...ranks), 1) });
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);
    session().act('stand');
    jest.runAllTimers();

    expect(session().revealTier).toBe(0); // fresh shoe → fogged
    const check = session().countCheck!;
    expect(check.shuffledAfter).toBe(true);
    session().answerCountCheck(check.correct);
    expect(session().revealTier).toBe(0); // boundary check cannot unlock
  });
});
