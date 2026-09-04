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
  it("deals the casino's own shoe regardless of the deck-count setting", () => {
    useSettingsStore.getState().hydrate({
      ...createDefaultSave().settings,
      deckCounts: { regular: 8, quiz: 1 },
    });
    expect(session().startSession(1)).toBe(true);
    expect(session().shoe?.deckCount).toBe(1); // Luna Luxe is single-deck
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

describe('Full-coach autoplay drill follows the Training switch', () => {
  it('refuses to start with Training Mode off, whatever coach level is stored', () => {
    // FEATURES.countCoachDial is off: Training off runs Learn, and the
    // Full-coach drill is unreachable there.
    useSettingsStore.getState().setTrainingMode(false);
    for (const level of ['off', 'learn', 'full'] as const) {
      useSettingsStore.getState().setCountCoachLevel(level);
      expect(session().startSession(1)).toBe(true);
      expect(session().startAutoplay()).toBe(false);
      expect(session().autoplay).toBe(false);
      session().endSession();
    }
    expect(useEconomyStore.getState().chips).toBe(500);
  });

  it('starts with Training Mode on (Full coach), whatever coach level is stored', () => {
    useSettingsStore.getState().setTrainingMode(true);
    for (const level of ['off', 'learn', 'full'] as const) {
      useSettingsStore.getState().setCountCoachLevel(level);
      expect(session().startSession(1)).toBe(true);
      expect(session().startAutoplay()).toBe(true);
      expect(session().autoplay).toBe(true);
      session().stopAutoplay();
      session().endSession();
    }
  });
});

describe('Training Mode on: no count checks, nothing to prove', () => {
  beforeEach(() => {
    useSettingsStore.getState().setTrainingMode(true);
    expect(session().startSession(1)).toBe(true);
  });

  it('never pops a post-round check and refuses tap-to-prove', () => {
    playWinningRound();
    expect(session().countCheck).toBeNull();
    expect(session().requestCountCheck()).toBe(false);
  });
});

describe('Training switch never touches the shoe or the count', () => {
  it('counts every card while off, so flipping on mid-round shows the true count', () => {
    useSettingsStore.getState().setTrainingMode(false);
    expect(session().startSession(1)).toBe(true);
    // Player 5, hole K (hidden), player 6, up 4 → visible so far: +1 +1 +1.
    rig('5', 'K', '6', '4', '2', '9');
    dealRound(1);
    expect(session().runningCount).toBe(3);
    expect(session().getCardsRemainingVisible()).toBe(36 - 4);

    // Hit mid-round with Training still off: the 2 is +1.
    expect(session().act('hit')).toBe(true);
    jest.advanceTimersByTime(600); // action cooldown
    expect(session().runningCount).toBe(4);
    expect(session().getCardsRemainingVisible()).toBe(36 - 5);

    // Flip on: nothing recomputes — the same tracked numbers simply show.
    useSettingsStore.getState().setTrainingMode(true);
    expect(session().runningCount).toBe(4);
    // +4 with 31 of 52 cards left → 4 / 0.596 = 6.7 → nearest half.
    expect(session().getTrueCount()).toBe(6.5);

    // Stand: the hole K lands (-1), the dealer draws the 9 (0).
    expect(session().act('stand')).toBe(true);
    jest.runAllTimers();
    expect(session().runningCount).toBe(3);
  });

  it('deals each card once per shoe and reshuffles only at the cut card', () => {
    useSettingsStore.getState().setTrainingMode(false);
    expect(session().startSession(1)).toBe(true);
    const firstShoe = session().shoe!;
    expect(firstShoe.cards).toHaveLength(52);
    expect(new Set(firstShoe.cards.map((card) => card.id)).size).toBe(52);

    // Every card that lands on the felt, by identity, until the shoe turns over.
    const dealtIds: string[] = [];
    const unsubscribe = useGameSessionStore.subscribe((state, previous) => {
      if (!state.round || state.round === previous.round) {
        return;
      }
      for (const hand of state.round.playerHands) {
        hand.cards.forEach((card) => dealtIds.push(card.id));
      }
      state.round.dealerHand.cards.forEach((card) => dealtIds.push(card.id));
    });

    // Draws copy the shoe but share its card array; only a shuffle replaces it.
    const shuffled = () => session().shoe!.cards !== firstShoe.cards;
    let rounds = 0;
    while (!shuffled() && rounds < 40) {
      const before = session().shoe!.drawnCount;
      expect(session().addChipToBet(1)).toBe(true);
      expect(session().deal()).toBe(true);
      jest.advanceTimersByTime(3500);
      // The cursor only ever moves forward, Training on or off.
      expect(session().shoe!.drawnCount).toBeGreaterThan(before);
      if (session().phase === 'playerTurn') {
        expect(session().act('stand')).toBe(true);
      }
      jest.runAllTimers();
      rounds += 1;
    }
    unsubscribe();

    expect(shuffled()).toBe(true);
    const unique = new Set(dealtIds);
    // Duplicates in the log are the same card re-rendered across store
    // updates; every id must belong to the first shoe and no card may be
    // dealt twice before the reshuffle.
    expect(unique.size).toBeGreaterThan(40);
    const firstIds = new Set(firstShoe.cards.map((card) => card.id));
    unique.forEach((id) => expect(firstIds.has(id)).toBe(true));
    const cardsDealtBeforeShuffle = firstShoe.cards.slice(0, unique.size).map((card) => card.id);
    expect(new Set(cardsDealtBeforeShuffle)).toEqual(unique);

    // A fresh 52 after the shuffle, count fogged and reset.
    expect(session().shoe!.drawnCount).toBe(0);
    expect(session().shoe!.cards).toHaveLength(52);
    expect(session().runningCount).toBe(0);
  });
});

describe('Learn coach never interrupts play (FEATURES.autoCountChecks off)', () => {
  // The coach's own post-round cadence lives on behind the flag; see
  // count-check-cadence.test.ts. At the table the only Count Check is the one
  // the player asks for.
  beforeEach(() => {
    useSettingsStore.getState().setTrainingMode(false);
    useSettingsStore.getState().setCountCoachLevel('learn');
    expect(session().startSession(1)).toBe(true);
  });

  it('never pops a post-round check, however many rounds go by', () => {
    for (let i = 0; i < 4; i++) {
      playWinningRound();
      expect(session().countCheck).toBeNull();
      expect(session().learnStreak).toBe(0);
    }
    expect(useModeStatsStore.getState().learn.checksAsked).toBe(0);
    // Tap-to-prove is still there.
    expect(session().requestCountCheck()).toBe(true);
  });

  it('stays quiet whatever coach level is stored (dial disabled → Training off is Learn)', () => {
    for (const level of ['off', 'full'] as const) {
      resetStores();
      useSettingsStore.getState().setTrainingMode(false);
      useSettingsStore.getState().setCountCoachLevel(level);
      expect(session().startSession(1)).toBe(true);
      playWinningRound();
      expect(session().countCheck).toBeNull();
    }
  });

  it('a player-requested check still pays 3 XP and builds the streak; a miss resets it', () => {
    playWinningRound();
    const xpAfterRound = useProgressionStore.getState().xpIntoLevel; // hand XP
    expect(session().requestCountCheck()).toBe(true);
    const check = session().countCheck!;
    // 10, 10, 9, 8 → −1 −1 0 0 = −2.
    expect(check.kind).toBe('running');
    expect(check.correct).toBe(-2);
    expect(session().answerCountCheck(check.correct)).toBe(true);
    expect(session().learnStreak).toBe(1);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(xpAfterRound + 3);
    session().dismissCountCheck();
    expect(session().countCheck).toBeNull();

    expect(session().requestCountCheck()).toBe(true);
    expect(session().answerCountCheck(session().countCheck!.correct + 1)).toBe(false);
    expect(session().learnStreak).toBe(0);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(xpAfterRound + 3);
    expect(useModeStatsStore.getState().learn).toEqual({
      checksAsked: 2,
      checksCorrect: 1,
      bestStreak: 1,
    });
  });
});

describe('Learn fog-of-war meter (revealTier, Training Mode off)', () => {
  beforeEach(() => {
    useSettingsStore.getState().setTrainingMode(false);
    useSettingsStore.getState().setCountCoachLevel('learn');
    expect(session().startSession(1)).toBe(true);
  });

  it('climbs a tier per proven check (capped at 2) and falls on a miss', () => {
    expect(session().revealTier).toBe(0);

    expect(session().requestCountCheck()).toBe(true);
    session().answerCountCheck(session().countCheck!.correct);
    session().dismissCountCheck();
    expect(session().revealTier).toBe(1); // running count revealed

    expect(session().requestCountCheck()).toBe(true);
    session().answerCountCheck(session().countCheck!.correct);
    session().dismissCountCheck();
    expect(session().revealTier).toBe(2); // true count revealed

    // Capped at 2.
    expect(session().requestCountCheck()).toBe(true);
    session().answerCountCheck(session().countCheck!.correct);
    session().dismissCountCheck();
    expect(session().revealTier).toBe(2);

    // A miss fogs one tier back.
    expect(session().requestCountCheck()).toBe(true);
    session().answerCountCheck(session().countCheck!.correct + 1);
    expect(session().revealTier).toBe(1);
  });

  it('a shuffle fogs the meter without popping a boundary check', () => {
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
    expect(session().countCheck).toBeNull(); // no coach interruption
    expect(session().shoe!.drawnCount).toBe(0);
    expect(session().runningCount).toBe(0);
  });

  it('tap-to-reveal asks for the tier being unlocked, only between hands in Learn', () => {
    expect(session().requestCountCheck()).toBe(true);
    expect(session().countCheck!.kind).toBe('running'); // tier 0 → running
    session().answerCountCheck(session().countCheck!.correct);
    session().dismissCountCheck();
    expect(session().revealTier).toBe(1);

    expect(session().requestCountCheck()).toBe(true);
    expect(session().countCheck!.kind).toBe('true'); // tier 1 → true count
    session().dismissCountCheck();

    // Not during a live round…
    rig('10', '10', '9', '8');
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);
    expect(session().requestCountCheck()).toBe(false);
    session().act('stand');
    jest.runAllTimers();
    expect(session().countCheck).toBeNull(); // the coach didn't pop one either

    // …and the stored dial level is irrelevant while the dial is disabled:
    // Training off runs Learn, so tap-to-reveal keeps working.
    useSettingsStore.getState().setCountCoachLevel('full');
    expect(session().requestCountCheck()).toBe(true);
    session().dismissCountCheck();

    // Flip Training on → live counts, nothing to prove.
    useSettingsStore.getState().setTrainingMode(true);
    expect(session().requestCountCheck()).toBe(false);
  });
});
