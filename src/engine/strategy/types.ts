import { PlayerAction } from '../blackjack/rules';

export interface StrategyRecommendation {
  readonly preferredAction: PlayerAction;
  /** Correct action when the preferred one is unavailable (can't double/split). */
  readonly fallbackAction?: PlayerAction;
  /** Stable code identifying the rule that fired, e.g. "HARD_11_DOUBLE". */
  readonly reasonCode: string;
}

/** What the player is currently allowed to do; the engine resolves fallbacks with this. */
export interface ActionAvailability {
  readonly canDouble: boolean;
  readonly canSplit: boolean;
}
