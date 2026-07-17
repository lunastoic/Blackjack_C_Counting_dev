/**
 * The authoritative round phase (REBUILD_SPEC §10). Every UI boolean in later
 * milestones is DERIVED from this — the phase is the single source of truth.
 */
export type RoundPhase =
  | 'betting'
  | 'dealing'
  | 'playerTurn'
  | 'dealerTurn'
  | 'resolution'
  | 'payout'
  | 'collecting'
  | 'shuffling';

/**
 * Legal transitions:
 * - dealing → resolution short-circuits the round on a natural blackjack.
 * - playerTurn → dealerTurn even when every hand busted (the dealer still
 *   reveals the hole card; drawing is skipped by the round controller).
 * - collecting → shuffling when penetration was reached during the round.
 */
export const VALID_TRANSITIONS: Readonly<Record<RoundPhase, readonly RoundPhase[]>> = {
  betting: ['dealing'],
  dealing: ['playerTurn', 'resolution'],
  playerTurn: ['dealerTurn'],
  dealerTurn: ['resolution'],
  resolution: ['payout'],
  payout: ['collecting'],
  collecting: ['betting', 'shuffling'],
  shuffling: ['betting'],
};

export function canTransition(from: RoundPhase, to: RoundPhase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
