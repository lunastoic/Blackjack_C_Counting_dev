import {
  addChip,
  BetState,
  canAddChip,
  canAffordDouble,
  canAffordSplit,
  canRedoBet,
  isAllIn,
  isValidBet,
  redoBet,
  returnBet,
} from '../../engine/betting/bets';
import { CASINO_MAPS, LUNA_LUXE, STARTING_BANKROLL } from '../../engine/betting/casino';

const MAX = LUNA_LUXE.maxBet;

describe('Luna Luxe table data', () => {
  it('matches the spec', () => {
    expect(LUNA_LUXE.maxBet).toBe(1000);
    expect(LUNA_LUXE.chipDenominations).toEqual([1, 5, 25, 50, 100]);
    expect(LUNA_LUXE.unlockLevel).toBe(1);
    expect(STARTING_BANKROLL).toBe(500);
    expect(CASINO_MAPS).toHaveLength(6);
  });
});

describe('bet validity', () => {
  it('requires a positive wager within the max bet', () => {
    expect(isValidBet(0, MAX)).toBe(false);
    expect(isValidBet(-5, MAX)).toBe(false);
    expect(isValidBet(1, MAX)).toBe(true);
    expect(isValidBet(1000, MAX)).toBe(true);
    expect(isValidBet(1001, MAX)).toBe(false);
    expect(isValidBet(10.5, MAX)).toBe(false);
  });
});

describe('adding chips', () => {
  it('moves chips from bankroll to wager immediately', () => {
    const state: BetState = { wager: 0, bankroll: 500 };
    const next = addChip(state, 100, MAX);
    expect(next).toEqual({ wager: 100, bankroll: 400 });
  });

  it('rejects chips the player cannot afford', () => {
    const state: BetState = { wager: 0, bankroll: 20 };
    expect(canAddChip(state, 25, MAX)).toBe(false);
    expect(addChip(state, 25, MAX)).toEqual(state); // unchanged
  });

  it('caps the wager at the map max bet', () => {
    const state: BetState = { wager: 950, bankroll: 5000 };
    expect(canAddChip(state, 100, MAX)).toBe(false);
    expect(canAddChip(state, 50, MAX)).toBe(true);
  });
});

describe('return and redo bet', () => {
  it('return bet refunds the whole wager', () => {
    expect(returnBet({ wager: 175, bankroll: 325 })).toEqual({ wager: 0, bankroll: 500 });
  });

  it('redo bet replays the last bet when affordable', () => {
    const state: BetState = { wager: 0, bankroll: 500 };
    expect(canRedoBet(100, state, MAX)).toBe(true);
    expect(redoBet(100, state, MAX)).toEqual({ wager: 100, bankroll: 400 });
  });

  it('redo bet replaces any chips already placed', () => {
    const state: BetState = { wager: 50, bankroll: 450 };
    expect(redoBet(200, state, MAX)).toEqual({ wager: 200, bankroll: 300 });
  });

  it('redo bet is rejected when unaffordable or over the max', () => {
    expect(canRedoBet(600, { wager: 0, bankroll: 500 }, MAX)).toBe(false);
    expect(canRedoBet(0, { wager: 0, bankroll: 500 }, MAX)).toBe(false);
    expect(canRedoBet(2000, { wager: 0, bankroll: 5000 }, 1000)).toBe(false);
    const state: BetState = { wager: 0, bankroll: 100 };
    expect(redoBet(500, state, MAX)).toEqual(state); // unchanged
  });
});

describe('double and split affordability', () => {
  it('requires matching the hand bet', () => {
    expect(canAffordDouble(100, 100)).toBe(true);
    expect(canAffordDouble(99, 100)).toBe(false);
    expect(canAffordSplit(100, 100)).toBe(true);
    expect(canAffordSplit(0, 1)).toBe(false);
  });
});

describe('all-in detection', () => {
  it('is all-in only when the bankroll is empty and a wager exists', () => {
    expect(isAllIn({ wager: 500, bankroll: 0 })).toBe(true);
    expect(isAllIn({ wager: 499, bankroll: 1 })).toBe(false);
    expect(isAllIn({ wager: 0, bankroll: 0 })).toBe(false);
  });
});
