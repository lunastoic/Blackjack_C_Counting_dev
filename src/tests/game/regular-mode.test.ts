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
 * The merged table (one mode, Count Coach dial), per-map configuration, the
 * Full-coach autoplay drill, Learn-coach count checks, and the
 * pendingReveals true-count fix. Shoes are rigged; timers are faked.
 */

function resetStores(chips = 500): void {
  useGameSessionStore.getState().endSession();
  const defaults = createDefaultSave();
  useEconomyStore.getState().hydrate({ ...defaults.economy, chips });
  useProgressionStore.getState().hydrate({ ...defaults.progression, unlockedMapIds: [1, 2, 3] });
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

function dealRound(bet: number): void {
  expect(session().addChipToBet(bet)).toBe(true);
  expect(session().deal()).toBe(true);
  jest.advanceTimersByTime(3500);
}

/** Deal → stand → settle a rigged winning hand (19 vs dealer 18). */
function playWinningRound(): void {
  rig('10', '10', '9', '8');
  dealRound(100);
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

describe('table sessions', () => {
  it('uses the table deck-count setting and the betting/payout rules', () => {
    useSettingsStore.getState().hydrate({
      ...createDefaultSave().settings,
      deckCounts: { regular: 8, quiz: 1 },
    });
    expect(session().startSession(1)).toBe(true);
    expect(session().shoe?.deckCount).toBe(8);
  });

  it('always tracks the running count internally (the coach decides visibility)', () => {
    expect(session().startSession(1)).toBe(true);
    rig('5', 'K', '6', '4');
    dealRound(100);
    // The store must keep counting so shuffles reset correctly; only the
    // presentation layer hides it when the coach is Off or Learn.
    expect(session().runningCount).toBe(3);
  });

  it('records persisted table stats for wins', () => {
    expect(session().startSession(1)).toBe(true);
    playWinningRound();

    expect(useModeStatsStore.getState().regular).toEqual({
      handsPlayed: 1,
      wins: 1,
      pushes: 0,
      losses: 0,
      blackjacks: 0,
      netChips: 100,
    });
  });

  it('records losses, pushes, and blackjacks with net chip flow', () => {
    expect(session().startSession(1)).toBe(true);

    rig('10', '10', '7', '9'); // loss: 17 vs 19
    dealRound(100);
    expect(session().act('stand')).toBe(true);
    jest.runAllTimers();

    rig('10', '10', '9', '9'); // push: 19 vs 19
    dealRound(100);
    expect(session().act('stand')).toBe(true);
    jest.runAllTimers();

    rig('A', '9', 'K', '7'); // natural blackjack, 3:2
    expect(session().addChipToBet(100)).toBe(true);
    expect(session().deal()).toBe(true);
    jest.runAllTimers();

    expect(useModeStatsStore.getState().regular).toEqual({
      handsPlayed: 3,
      wins: 1, // the blackjack counts as a win
      pushes: 1,
      losses: 1,
      blackjacks: 1,
      netChips: -100 + 0 + 150,
    });
  });

  it('refunds an interrupted round', () => {
    expect(session().startSession(1)).toBe(true);
    rig('10', '10', '9', '8');
    dealRound(100);
    expect(useEconomyStore.getState().chips).toBe(400);
    session().endSession(); // player leaves mid-hand
    expect(useEconomyStore.getState().chips).toBe(500);
  });
});

describe('map-specific configuration', () => {
  it('loads each map with its own denominations and max bet', () => {
    expect(session().startSession(3)).toBe(true);
    const map = session().map!;
    expect(map.name).toBe('Europa Ice Palace');
    expect(map.chipDenominations).toEqual([25, 50, 100, 500, 1000]);
    expect(map.maxBet).toBe(10_000);
    expect(map.chipSetKey).toBe('europa');
    expect(map.feltKey).toBe('blue-suede');
  });

  it('enforces the active map max bet, not Luna Luxe defaults', () => {
    useEconomyStore.getState().hydrate({ ...createDefaultSave().economy, chips: 20_000 });
    expect(session().startSession(3)).toBe(true);
    // 10 × 1000 = the Europa max bet; an 11th chip must be refused.
    for (let i = 0; i < 10; i++) {
      expect(session().addChipToBet(1000)).toBe(true);
    }
    expect(session().addChipToBet(1000)).toBe(false);
    expect(session().wager).toBe(10_000);
  });

  it('rejects unknown maps', () => {
    expect(session().startSession(99)).toBe(false);
    expect(session().sessionActive).toBe(false);
  });
});

describe('true count during dealer reveals (pendingReveals fix)', () => {
  it('keeps visible cards-remaining stable until each draw is actually shown', () => {
    expect(session().startSession(1)).toBe(true);
    // Player 20 stands; dealer 6 hole + 5 up = 11 → draws until 17+.
    // The rigged shoe holds 7 scripted + 30 filler = 37 cards.
    rig('10', '6', '10', '5', '2', '4', 'K');
    dealRound(100);

    expect(session().getCardsRemainingVisible()).toBe(33); // 37 − 4 dealt
    expect(session().act('stand')).toBe(true);

    jest.advanceTimersByTime(700); // dealer sequence begins
    expect(session().phase).toBe('dealerTurn');
    // The engine has already drawn the dealer's cards into the shoe, but none
    // are revealed yet — the visible remaining must still be 33.
    expect(session().pendingReveals).toBeGreaterThan(0);
    expect(session().getCardsRemainingVisible()).toBe(33);

    jest.advanceTimersByTime(700); // hole reveal (no pending decrement)
    expect(session().getCardsRemainingVisible()).toBe(33);

    jest.advanceTimersByTime(700); // first dealer draw becomes visible
    expect(session().getCardsRemainingVisible()).toBe(32);

    jest.runAllTimers();
    expect(session().pendingReveals).toBe(0);
  });
});

describe('Full-coach autoplay drill', () => {
  it('plays a full hand with no chips, XP, or lifetime stats at stake', () => {
    useSettingsStore.getState().setCountCoachLevel('full');
    expect(session().startSession(1)).toBe(true);
    rig('10', '10', '9', '8'); // bot stands on 19; dealer 18 → "win"
    expect(session().startAutoplay()).toBe(true);

    jest.advanceTimersByTime(700 + 3500); // autoDeal + paced opening deal
    expect(session().isAutoplayRound).toBe(true);

    session().stopAutoplay(); // finish the current hand, then stop
    jest.runAllTimers();

    expect(session().phase).toBe('betting');
    expect(session().autoplay).toBe(false);
    expect(useEconomyStore.getState().chips).toBe(500);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(0);
    expect(useAchievementStore.getState().stats.handsPlayed).toBe(0);
    expect(useModeStatsStore.getState().regular.handsPlayed).toBe(0);
  });

  it('returns any staged wager and refuses unless the coach is Full', () => {
    useSettingsStore.getState().setCountCoachLevel('full');
    expect(session().startSession(1)).toBe(true);
    expect(session().addChipToBet(100)).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(400);
    expect(session().startAutoplay()).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(500);
    expect(session().wager).toBe(0);
    session().stopAutoplay();
    jest.runAllTimers();

    for (const level of ['off', 'learn'] as const) {
      useSettingsStore.getState().setCountCoachLevel(level);
      expect(session().startAutoplay()).toBe(false);
    }
  });

  it('blocks manual betting and dealing while the drill runs', () => {
    useSettingsStore.getState().setCountCoachLevel('full');
    expect(session().startSession(1)).toBe(true);
    expect(session().startAutoplay()).toBe(true);
    expect(session().addChipToBet(25)).toBe(false);
    expect(session().deal()).toBe(false);
    session().stopAutoplay();
    jest.runAllTimers();
  });

  it('ends the session without refunding drill hands', () => {
    useSettingsStore.getState().setCountCoachLevel('full');
    expect(session().startSession(1)).toBe(true);
    rig('10', '10', '9', '8');
    expect(session().startAutoplay()).toBe(true);
    jest.advanceTimersByTime(700 + 3500); // mid-drill
    expect(session().isAutoplayRound).toBe(true);

    session().endSession();
    expect(useEconomyStore.getState().chips).toBe(500); // no phantom refund
  });
});

describe('Learn coach count checks', () => {
  beforeEach(() => {
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

  it('never checks when the coach is Off or Full, or during the drill', () => {
    for (const level of ['off', 'full'] as const) {
      resetStores();
      useSettingsStore.getState().setCountCoachLevel(level);
      expect(session().startSession(1)).toBe(true);
      playWinningRound();
      expect(session().countCheck).toBeNull();
    }
  });
});
