import { Rank } from '../../engine/cards/card';
import { cardsRemaining } from '../../engine/shoe/shoe';
import { cardsOf, riggedShoe } from '../../engine/testing/fixtures';
import { createDefaultSave } from '../../persistence/defaults';
import { useAchievementStore } from '../../stores/achievementStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';

/** Betting rules, action cooldown, shuffle lifecycle, and round cleanup. */

function resetStores(chips = 500, lastBet = 0): void {
  // End any leftover session FIRST — ending an interrupted round refunds its
  // bets, which would otherwise pollute the freshly hydrated balance.
  useGameSessionStore.getState().endSession();
  const defaults = createDefaultSave();
  useEconomyStore.getState().hydrate({ ...defaults.economy, chips, lastBet });
  useProgressionStore.getState().hydrate(defaults.progression);
  useAchievementStore.getState().hydrate(defaults.achievements, defaults.mapAchievements);
  useSettingsStore.getState().hydrate({
    ...defaults.settings,
    deckCounts: { regular: 1, quiz: 6 },
  });
}

function rig(...ranks: Rank[]): void {
  const filler = Array.from({ length: 30 }, () => '7' as Rank);
  useGameSessionStore.setState({ shoe: riggedShoe(cardsOf(...ranks, ...filler), 1) });
}

function session() {
  return useGameSessionStore.getState();
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStores();
  expect(session().startSession(1)).toBe(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('betting', () => {
  it('adds chips to the bet and debits the bankroll immediately', () => {
    expect(session().addChipToBet(25)).toBe(true);
    expect(session().addChipToBet(5)).toBe(true);
    expect(session().wager).toBe(30);
    expect(useEconomyStore.getState().chips).toBe(470);
  });

  it('refuses chips the player cannot afford', () => {
    resetStores(20);
    session().startSession(1);
    expect(session().addChipToBet(25)).toBe(false);
    expect(session().wager).toBe(0);
    expect(useEconomyStore.getState().chips).toBe(20);
  });

  it('enforces the Luna Luxe 1,000 max bet', () => {
    resetStores(5_000);
    session().startSession(1);
    for (let i = 0; i < 10; i++) {
      expect(session().addChipToBet(100)).toBe(true);
    }
    expect(session().wager).toBe(1_000);
    expect(session().addChipToBet(100)).toBe(false);
    expect(session().addChipToBet(1)).toBe(false);
    expect(session().wager).toBe(1_000);
  });

  it('Return Bet refunds the whole wager', () => {
    session().addChipToBet(50);
    session().addChipToBet(25);
    session().returnBet();
    expect(session().wager).toBe(0);
    expect(useEconomyStore.getState().chips).toBe(500);
  });

  it('Redo Bet replays the previous bet when affordable', () => {
    resetStores(500, 75);
    session().startSession(1);
    session().redoBet();
    expect(session().wager).toBe(75);
    expect(useEconomyStore.getState().chips).toBe(425);
  });

  it('Redo Bet replaces the current wager instead of stacking on top', () => {
    resetStores(500, 75);
    session().startSession(1);
    session().addChipToBet(100);
    session().redoBet();
    expect(session().wager).toBe(75);
    expect(useEconomyStore.getState().chips).toBe(425);
  });

  it('Redo Bet does nothing when the previous bet is unaffordable', () => {
    resetStores(50, 200);
    session().startSession(1);
    session().redoBet();
    expect(session().wager).toBe(0);
    expect(useEconomyStore.getState().chips).toBe(50);
  });

  it('cannot deal without a wager', () => {
    expect(session().deal()).toBe(false);
    expect(session().phase).toBe('betting');
  });

  it('records an all-in bet for achievements', () => {
    resetStores(100);
    session().startSession(1);
    rig('5', 'K', '6', '4');
    session().addChipToBet(100);
    session().deal();
    expect(useAchievementStore.getState().stats.allInBets).toBe(1);
  });
});

describe('action cooldown', () => {
  it('ignores rapid repeated actions inside the 600 ms window', () => {
    rig('2', 'K', '3', '4', '2', '3');
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);

    expect(session().act('hit')).toBe(true); // 5 + 2 = 7
    expect(session().act('hit')).toBe(false); // blocked by cooldown
    expect(session().round?.playerHands[0].cards).toHaveLength(3);

    jest.advanceTimersByTime(600);
    expect(session().act('hit')).toBe(true); // 7 + 3 = 10
    expect(session().round?.playerHands[0].cards).toHaveLength(4);
  });
});

describe('shuffle lifecycle', () => {
  it('warns during the round and shuffles with a count reset afterwards', () => {
    // 10-card shoe: after the 4-card deal only 6 remain (1-deck 88% cut → 6).
    const ranks: Rank[] = ['10', '5', '9', '8', ...Array.from({ length: 6 }, () => '2' as Rank)];
    useGameSessionStore.setState({ shoe: riggedShoe(cardsOf(...ranks), 1) });

    session().addChipToBet(100);
    session().deal();
    expect(session().shufflePending).toBe(true);
    jest.advanceTimersByTime(3500);

    expect(session().act('stand')).toBe(true);
    expect(session().runningCount).not.toBe(0);
    jest.runAllTimers();

    const state = session();
    expect(state.phase).toBe('betting');
    expect(state.runningCount).toBe(0); // count reset by the shuffle
    expect(state.shufflePending).toBe(false);
    expect(state.shoe && cardsRemaining(state.shoe)).toBe(52); // fresh shoe
  });

  it('rebuilds the shoe when the deck-count setting changed mid-session', () => {
    rig('10', '10', '9', '8');
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);
    useSettingsStore.getState().setDeckCount('regular', 2);
    session().act('stand');
    jest.runAllTimers();

    const state = session();
    expect(state.shoe?.deckCount).toBe(2);
    expect(state.shoe && cardsRemaining(state.shoe)).toBe(104);
    expect(state.runningCount).toBe(0);
  });

  it('reshuffles and resets the count immediately when decks change between hands', () => {
    rig('10', '10', '9', '8');
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);
    session().act('stand');
    jest.runAllTimers();

    expect(session().phase).toBe('betting');
    expect(session().runningCount).not.toBe(0);

    useSettingsStore.getState().setDeckCount('regular', 2);
    session().applyDeckCountChange();

    const state = session();
    expect(state.phase).toBe('betting');
    expect(state.shoe?.deckCount).toBe(2);
    expect(state.shoe && cardsRemaining(state.shoe)).toBe(104);
    expect(state.runningCount).toBe(0);
    expect(state.justShuffled).toBe(true);
  });
});

describe('round cleanup and interrupted rounds', () => {
  it('clears the table back to betting after a round completes', () => {
    rig('10', '10', '9', '8');
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);
    session().act('stand');
    jest.runAllTimers();

    const state = session();
    expect(state.phase).toBe('betting');
    expect(state.round).toBeNull();
    expect(state.resolution).toBeNull();
    expect(state.payout).toBeNull();
    expect(state.wager).toBe(0);
  });

  it('refunds an undealt wager when the session ends', () => {
    session().addChipToBet(100);
    session().endSession();
    expect(useEconomyStore.getState().chips).toBe(500);
    expect(session().sessionActive).toBe(false);
  });

  it('refunds live hand bets (including a double) when a round is interrupted', () => {
    rig('5', '10', '6', '6', '9');
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);
    expect(session().act('double')).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(300);

    session().endSession(); // interrupted before the dealer finished
    expect(useEconomyStore.getState().chips).toBe(500);
    expect(session().round).toBeNull();
  });

  it('does not refund after the payout already credited the bankroll', () => {
    rig('10', '10', '9', '8'); // win: 19 vs 18
    session().addChipToBet(100);
    session().deal();
    jest.advanceTimersByTime(3500);
    session().act('stand');
    jest.runAllTimers();
    expect(useEconomyStore.getState().chips).toBe(600);

    session().endSession();
    expect(useEconomyStore.getState().chips).toBe(600); // unchanged
  });
});
