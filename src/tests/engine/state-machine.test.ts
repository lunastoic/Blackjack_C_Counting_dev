import {
  canTransition,
  RoundPhase,
  VALID_TRANSITIONS,
} from '../../engine/state-machine/phases';
import {
  InvalidTransitionError,
  PhaseMachine,
  transition,
} from '../../engine/state-machine/machine';

const ALL_PHASES: RoundPhase[] = [
  'betting',
  'dealing',
  'playerTurn',
  'dealerTurn',
  'resolution',
  'payout',
  'collecting',
  'shuffling',
];

describe('valid transitions', () => {
  it('walks the normal round flow', () => {
    const machine = new PhaseMachine();
    expect(machine.phase).toBe('betting');
    for (const next of [
      'dealing',
      'playerTurn',
      'dealerTurn',
      'resolution',
      'payout',
      'collecting',
      'betting',
    ] as RoundPhase[]) {
      expect(machine.can(next)).toBe(true);
      machine.transitionTo(next);
      expect(machine.phase).toBe(next);
    }
  });

  it('short-circuits dealing → resolution on a natural blackjack', () => {
    expect(canTransition('dealing', 'resolution')).toBe(true);
  });

  it('routes all-busted rounds through dealerTurn (hole reveal only)', () => {
    expect(canTransition('playerTurn', 'dealerTurn')).toBe(true);
    expect(canTransition('playerTurn', 'resolution')).toBe(false);
  });

  it('supports the shuffle branch after collection', () => {
    const machine = new PhaseMachine('collecting');
    machine.transitionTo('shuffling');
    machine.transitionTo('betting');
    expect(machine.phase).toBe('betting');
  });
});

describe('invalid transitions', () => {
  it('rejects everything not in the table', () => {
    for (const from of ALL_PHASES) {
      for (const to of ALL_PHASES) {
        const expected = VALID_TRANSITIONS[from].includes(to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it('throws a typed error and does not change state', () => {
    const machine = new PhaseMachine('betting');
    expect(() => machine.transitionTo('payout')).toThrow(InvalidTransitionError);
    expect(machine.phase).toBe('betting'); // unchanged

    try {
      machine.transitionTo('dealerTurn');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      const typed = error as InvalidTransitionError;
      expect(typed.from).toBe('betting');
      expect(typed.to).toBe('dealerTurn');
    }
  });

  it('pure transition() behaves identically', () => {
    expect(transition('betting', 'dealing')).toBe('dealing');
    expect(() => transition('shuffling', 'dealing')).toThrow(InvalidTransitionError);
  });

  it('cannot skip payout or collection', () => {
    expect(canTransition('resolution', 'betting')).toBe(false);
    expect(canTransition('payout', 'betting')).toBe(false);
    expect(canTransition('resolution', 'collecting')).toBe(false);
  });
});
