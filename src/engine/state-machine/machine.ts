import { canTransition, RoundPhase } from './phases';

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: RoundPhase,
    readonly to: RoundPhase,
  ) {
    super(`Invalid round phase transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Minimal stateful phase machine. Invalid transitions throw a typed error and
 * leave the current phase untouched.
 */
export class PhaseMachine {
  private current: RoundPhase;

  constructor(initial: RoundPhase = 'betting') {
    this.current = initial;
  }

  get phase(): RoundPhase {
    return this.current;
  }

  can(to: RoundPhase): boolean {
    return canTransition(this.current, to);
  }

  transitionTo(to: RoundPhase): RoundPhase {
    if (!this.can(to)) {
      throw new InvalidTransitionError(this.current, to);
    }
    this.current = to;
    return this.current;
  }
}

/** Pure functional variant: returns the next phase or throws InvalidTransitionError. */
export function transition(from: RoundPhase, to: RoundPhase): RoundPhase {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}
