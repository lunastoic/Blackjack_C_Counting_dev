import { Rank } from '../../engine/cards/card';
import { cardsOf, riggedShoe } from '../../engine/testing/fixtures';
import { createDefaultSave } from '../../persistence/defaults';
import { useAchievementStore } from '../../stores/achievementStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Game-session integration: engine ↔ store wiring for full rounds. Shoes are
 * rigged so every card is scripted; timers are faked so the paced dealer
 * sequence runs deterministically.
 *
 * Rigged deal order: player 1st, dealer hole, player 2nd, dealer upcard,
 * then hits / split follow-ups / dealer draws in draw order.
 */

function resetStores(chips = 500): void {
  // End any leftover session FIRST — ending an interrupted round refunds its
  // bets, which would otherwise pollute the freshly hydrated balance.
  useGameSessionStore.getState().endSession();
  const defaults = createDefaultSave();
  useEconomyStore.getState().hydrate({ ...defaults.economy, chips });
  useProgressionStore.getState().hydrate(defaults.progression);
  useAchievementStore.getState().hydrate(defaults.achievements, defaults.mapAchievements);
  useSettingsStore.getState().hydrate({
    ...defaults.settings,
    // Rigged one-deck shoes must match the settings deck count, or the store
    // would legitimately re-shuffle after every round.
    deckCounts: { training: 1, regular: 6, quiz: 6 },
  });
}

/** Replaces the live shoe with a scripted one, padded to stay above penetration. */
function rig(...ranks: Rank[]): void {
  const filler = Array.from({ length: 30 }, () => '7' as Rank);
  useGameSessionStore.setState({ shoe: riggedShoe(cardsOf(...ranks, ...filler), 1) });
}

function session() {
  return useGameSessionStore.getState();
}

function startTraining(): void {
  expect(session().startSession(1, 'training')).toBe(true);
}

/** Advances past the paced opening deal (4 cards + settle). */
function advancePastInitialDeal(): void {
  jest.advanceTimersByTime(3500);
}

/** Places a bet and deals, then advances past the dealing phase. */
function dealRound(bet: number): void {
  expect(session().addChipToBet(bet)).toBe(true);
  expect(session().deal()).toBe(true);
  advancePastInitialDeal();
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStores();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('deal flow and visible-card counting', () => {
  it('deals one card at a time: player, dealer hole, player, dealer up', () => {
    startTraining();
    rig('5', 'K', '6', '4');
    expect(session().addChipToBet(100)).toBe(true);
    expect(session().deal()).toBe(true);
    expect(session().phase).toBe('dealing');
    expect(session().initialDealStep).toBe(0);

    jest.advanceTimersByTime(60);
    expect(session().initialDealStep).toBe(1);
    expect(session().runningCount).toBe(1); // player 5

    jest.advanceTimersByTime(550);
    expect(session().initialDealStep).toBe(2);
    expect(session().runningCount).toBe(1); // hole still hidden

    jest.advanceTimersByTime(550);
    expect(session().initialDealStep).toBe(3);
    expect(session().runningCount).toBe(2); // player 6

    jest.advanceTimersByTime(550);
    expect(session().initialDealStep).toBe(4);
    expect(session().runningCount).toBe(3); // dealer 4 up

    jest.advanceTimersByTime(400);
    expect(session().phase).toBe('playerTurn');
  });

  it('deals player/hole/player/up, counts only the three visible cards', () => {
    startTraining();
    rig('5', 'K', '6', '4');
    dealRound(100);

    const state = session();
    expect(state.phase).toBe('playerTurn');
    expect(state.round?.playerHands[0].cards.map((c) => c.rank)).toEqual(['5', '6']);
    expect(state.round?.dealerHand.cards.map((c) => c.rank)).toEqual(['K', '4']);
    expect(state.round?.dealerHand.holeRevealed).toBe(false);
    expect(state.round?.dealerHand.cards[0].visibility).toBe('faceDown');
    // +1 (5) + +1 (6) + +1 (4); the K hole card is NOT counted.
    expect(state.runningCount).toBe(3);
  });

  it('debits the wager at chip placement and records the last bet at deal', () => {
    startTraining();
    rig('5', 'K', '6', '4');
    expect(session().addChipToBet(100)).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(400);
    expect(session().deal()).toBe(true);
    expect(useEconomyStore.getState().lastBet).toBe(100);
    expect(session().wager).toBe(0);
  });

  it('computes the true count from cards remaining, rounded to nearest 0.5', () => {
    startTraining();
    // 4 dealt of 34 → 30 remaining; running +3 → 3 / (30/52) = 5.2 → 5.0.
    rig('5', 'K', '6', '4');
    dealRound(100);
    expect(session().getTrueCount()).toBe(5);
  });
});

describe('hidden hole card behavior', () => {
  it('counts the hole card only when the dealer reveals it', () => {
    startTraining();
    // Player 10+9=19 stands; dealer K hole + 8 up = 18 stands (no draws).
    rig('10', 'K', '9', '8');
    dealRound(100);
    expect(session().runningCount).toBe(-1); // only the visible 10

    expect(session().act('stand')).toBe(true);
    jest.advanceTimersByTime(800); // dealer sequence starts
    jest.advanceTimersByTime(800); // hole reveal step

    const state = session();
    expect(state.round?.dealerHand.holeRevealed).toBe(true);
    expect(state.runningCount).toBe(-2); // K now counted
  });

  it('reveals the hole card but draws nothing when every hand busted', () => {
    startTraining();
    // Player 10+6 hits a K → 26 bust. Dealer 5 hole + 9 up = 14 must NOT draw.
    rig('10', '5', '6', '9', 'K');
    dealRound(100);
    jest.advanceTimersByTime(700);
    expect(session().act('hit')).toBe(true);
    expect(session().round?.playerHands[0].status).toBe('busted');

    jest.runAllTimers(); // dealer reveal → resolution → payout → collect
    const dealer = useAchievementStore.getState().stats;
    expect(dealer.busts).toBe(1);
    // Round is over; dealer kept exactly its two cards (checked via stats since
    // the round has been cleaned up: loss recorded, no dealer-bust win).
    expect(dealer.losses).toBe(1);
    expect(dealer.dealerBustWins).toBe(0);
    expect(useEconomyStore.getState().chips).toBe(400); // bet lost
  });
});

describe('payouts', () => {
  it('pays a natural blackjack 3:2 without a player turn', () => {
    startTraining();
    // Player A+K natural; dealer 9 hole + 7 up (no natural).
    rig('A', '9', 'K', '7');
    expect(session().addChipToBet(100)).toBe(true);
    expect(session().deal()).toBe(true);
    jest.runAllTimers();

    expect(useEconomyStore.getState().chips).toBe(650); // 400 + 100 + 150
    expect(useAchievementStore.getState().stats.blackjacks).toBe(1);
    expect(session().phase).toBe('betting');
  });

  it('pays 1:1 on a regular win and returns the stake on a push', () => {
    startTraining();
    // Win: player 10+9=19 vs dealer 10+8=18.
    rig('10', '10', '9', '8');
    dealRound(100);
    expect(session().act('stand')).toBe(true);
    jest.runAllTimers();
    expect(useEconomyStore.getState().chips).toBe(600);

    // Push: player 10+10=20 vs dealer 10+10=20.
    rig('10', '10', '10', '10');
    dealRound(100);
    expect(session().act('stand')).toBe(true);
    jest.runAllTimers();
    expect(useEconomyStore.getState().chips).toBe(600); // stake returned
    expect(useAchievementStore.getState().stats.pushes).toBe(1);
  });

  it('doubles the bet, deals exactly one card, and pays the doubled wager', () => {
    startTraining();
    // Player 5+6=11 doubles into a 9 (20); dealer 10 hole + 6 up = 16, draws K → 26 bust.
    rig('5', '10', '6', '6', '9', 'K');
    dealRound(100);

    expect(session().act('double')).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(300); // second 100 staked
    expect(session().round?.playerHands[0].bet).toBe(200);
    expect(session().round?.playerHands[0].cards).toHaveLength(3);

    jest.runAllTimers();
    expect(useEconomyStore.getState().chips).toBe(700); // 300 + 400 returned
    const stats = useAchievementStore.getState().stats;
    expect(stats.doubles).toBe(1);
    expect(stats.dealerBustWins).toBe(1);
  });
});

describe('split order and payouts', () => {
  it('splits once, plays the right hand first, and pays split 21 as 1:1', () => {
    startTraining();
    // Player 8+8 splits; right gets 3 (11), left gets 2 (10).
    // Right hits 10 → 21 (auto-stand); left hits 9 → 19, stands.
    // Dealer 10 hole + 7 up = 17 stands. Both hands win.
    rig('8', '10', '8', '7', '3', '2', '10', '9');
    dealRound(100);

    expect(session().canAct('split')).toBe(true);
    expect(session().act('split')).toBe(true);
    expect(useEconomyStore.getState().chips).toBe(300); // second stake

    let round = session().round!;
    expect(round.playerHands).toHaveLength(2);
    expect(round.splitUsed).toBe(true);
    expect(round.activeHandIndex).toBe(0); // right hand plays first
    expect(round.playerHands[0].cards.map((c) => c.rank)).toEqual(['8', '3']);
    expect(round.playerHands[1].cards.map((c) => c.rank)).toEqual(['8', '2']);

    jest.advanceTimersByTime(700);
    expect(session().act('hit')).toBe(true); // right: 8+3+10 = 21, auto-stands
    round = session().round!;
    expect(round.playerHands[0].status).toBe('stood');
    expect(round.activeHandIndex).toBe(1); // turn advanced to the left hand

    jest.advanceTimersByTime(700);
    expect(session().act('hit')).toBe(true); // left: 8+2+9 = 19
    jest.advanceTimersByTime(700);
    expect(session().act('stand')).toBe(true);

    jest.runAllTimers();
    // Split 21 is a plain win: each hand returns 200 → 300 + 400 = 700.
    expect(useEconomyStore.getState().chips).toBe(700);
    expect(useAchievementStore.getState().stats.splits).toBe(1);
    expect(useAchievementStore.getState().stats.handsPlayed).toBe(2);
  });

  it('refuses a second split', () => {
    startTraining();
    // Player 8+8 splits into 8+8 (right) and 8+3 (left).
    rig('8', '10', '8', '7', '8', '3');
    dealRound(100);
    expect(session().act('split')).toBe(true);
    jest.advanceTimersByTime(700);
    // The right hand is a pair of 8s again, but only one split is allowed.
    expect(session().canAct('split')).toBe(false);
    expect(session().act('split')).toBe(false);
  });
});

describe('XP and level rewards', () => {
  it('awards 3 XP for a win, 1 for a loss, 2 for a push', () => {
    startTraining();
    rig('10', '10', '9', '8'); // win 19 vs 18
    dealRound(50);
    session().act('stand');
    jest.runAllTimers();
    expect(useProgressionStore.getState().xpIntoLevel).toBe(3);

    rig('10', '10', '7', '9'); // loss 17 vs 19
    dealRound(50);
    session().act('stand');
    jest.runAllTimers();
    expect(useProgressionStore.getState().xpIntoLevel).toBe(4);

    rig('10', '10', '9', '9'); // push 19 vs 19
    dealRound(50);
    session().act('stand');
    jest.runAllTimers();
    expect(useProgressionStore.getState().xpIntoLevel).toBe(6);
  });

  it('level-up pays the chip reward and raises the level-up notice', () => {
    startTraining();
    useProgressionStore.getState().hydrate({ level: 1, xpIntoLevel: 28, unlockedMapIds: [1] });
    rig('10', '10', '9', '8'); // win → +3 XP → level 2
    dealRound(100);
    session().act('stand');
    jest.runAllTimers();

    expect(useProgressionStore.getState().level).toBe(2);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(1);
    // 500 − 100 bet + 200 win + 1000 level reward.
    expect(useEconomyStore.getState().chips).toBe(1600);
    expect(session().levelUpNotice).toEqual({ level: 2, chipReward: 1000 });
  });
});
