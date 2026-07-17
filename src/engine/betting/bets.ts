/**
 * Pure betting rule helpers. All amounts are integer chips; chips are deducted
 * from the bankroll the moment they are placed on a bet (REBUILD_SPEC §7).
 * No UI state lives here.
 */

export interface BetState {
  /** Chips currently in the bet circle. */
  readonly wager: number;
  /** Player chips NOT in play (the wager has already been deducted). */
  readonly bankroll: number;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer chip amount, got ${value}`);
  }
}

/** A round can start only with a positive wager within the map's max bet. */
export function isValidBet(wager: number, maxBet: number): boolean {
  return Number.isInteger(wager) && wager > 0 && wager <= maxBet;
}

export function canAddChip(state: BetState, chipValue: number, maxBet: number): boolean {
  return (
    Number.isInteger(chipValue) &&
    chipValue > 0 &&
    chipValue <= state.bankroll &&
    state.wager + chipValue <= maxBet
  );
}

/** Tap a chip from the tray onto the bet. Throws nothing; returns state unchanged when illegal. */
export function addChip(state: BetState, chipValue: number, maxBet: number): BetState {
  if (!canAddChip(state, chipValue, maxBet)) {
    return state;
  }
  return { wager: state.wager + chipValue, bankroll: state.bankroll - chipValue };
}

/** Return Bet: refund the whole wager to the bankroll. */
export function returnBet(state: BetState): BetState {
  return { wager: 0, bankroll: state.bankroll + state.wager };
}

/** Redo Bet: replay the previous round's bet if it's affordable and legal. */
export function canRedoBet(lastBet: number, state: BetState, maxBet: number): boolean {
  return lastBet > 0 && lastBet <= state.bankroll + state.wager && lastBet <= maxBet;
}

export function redoBet(lastBet: number, state: BetState, maxBet: number): BetState {
  if (!canRedoBet(lastBet, state, maxBet)) {
    return state;
  }
  assertInteger(lastBet, 'lastBet');
  return { wager: lastBet, bankroll: state.bankroll + state.wager - lastBet };
}

/** Doubling requires matching the hand's current bet from the bankroll. */
export function canAffordDouble(bankroll: number, handBet: number): boolean {
  return bankroll >= handBet;
}

/** Splitting requires matching the hand's bet for the second hand. */
export function canAffordSplit(bankroll: number, handBet: number): boolean {
  return bankroll >= handBet;
}

/** All-in: the entire remaining bankroll is on the table. */
export function isAllIn(state: BetState): boolean {
  return state.wager > 0 && state.bankroll === 0;
}
