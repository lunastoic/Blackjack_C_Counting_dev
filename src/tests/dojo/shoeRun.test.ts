import { resolveRound } from '../../engine/blackjack/resolve';
import { startRound } from '../../engine/blackjack/round';
import {
  expectedBet,
  handUnits,
  HEAT_LIMIT,
  heatAfterBet,
  scoreCalls,
  shoeRunStars,
  ShoeRunLevel,
  trainingLevelSpec,
} from '../../engine/dojo';
import { cardsOf, riggedShoe, seededRng } from '../../engine/testing/fixtures';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import { createDefaultSave } from '../../persistence/defaults';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { __setShoeRunRngForTests, useShoeRunStore } from '../../stores/shoeRunStore';
import { playBossPerfectly } from './shoeRunHelpers';

const boss = useShoeRunStore.getState;

beforeEach(() => {
  __resetPersistenceForTests();
  const defaults = createDefaultSave();
  useDojoStore.getState().hydrate(defaults.dojo);
  useEconomyStore.getState().hydrate(defaults.economy);
  useProgressionStore.getState().hydrate(defaults.progression);
  __setShoeRunRngForTests(seededRng(3));
});

afterEach(() => {
  __setShoeRunRngForTests();
});

describe('beat the shoe — rules', () => {
  it('heat cools each hand and flares on a leap of more than double', () => {
    expect(heatAfterBet(0, 1, 2)).toBe(0);
    expect(heatAfterBet(30, 2, 4)).toBe(24);
    expect(heatAfterBet(0, 1, 4)).toBe(36);
    expect(heatAfterBet(0, 1, 8)).toBe(HEAT_LIMIT);
  });

  it('with the pit boss watching, the right bet climbs no faster than double', () => {
    // +12 with 104 cards left is a true count of +6: five units by the ramp.
    expect(expectedBet(12, 104, 1, false)).toBe(5);
    expect(expectedBet(12, 104, 1, true)).toBe(2);
    expect(expectedBet(12, 104, 4, true)).toBe(5);
  });

  it('stars: one for finishing, the clear at its accuracy, three at perfect; none when backed off', () => {
    const spec = trainingLevelSpec(5, 6) as ShoeRunLevel;
    expect(shoeRunStars(spec, 0.5, false)).toBe(1);
    expect(shoeRunStars(spec, 0.8, false)).toBe(2);
    expect(shoeRunStars(spec, 0.95, false)).toBe(3);
    expect(shoeRunStars(spec, 1, true)).toBe(0);
    expect(scoreCalls([]).accuracy).toBe(1);
    expect(scoreCalls([{ kind: 'bet', right: true }, { kind: 'count', right: false }])).toMatchObject({
      calls: 2,
      right: 1,
      accuracy: 0.5,
    });
  });

  it('sets the bets beside a flat bettor on the same hand', () => {
    // Player 10+9 = 19 against the dealer's 10+8 = 18: a win.
    const step = startRound(40, riggedShoe(cardsOf('10', '10', '9', '8'), 1));
    const resolution = resolveRound({ ...step.round, activeHandIndex: null });
    expect(handUnits(resolution, 4, false)).toEqual({ you: 4, flat: 1 });
    expect(handUnits(resolution, 4, true)).toEqual({ you: 2, flat: 0.5 });
  });
});

describe('beat the shoe — store', () => {
  it('every boss played perfectly earns three stars and records the run', () => {
    for (const mapId of [1, 2, 3, 4, 5, 6]) {
      playBossPerfectly(mapId, 6);
      expect(boss().backedOff).toBe(false);
      expect(boss().score?.accuracy).toBe(1);
      expect(boss().stars).toBe(3);
      expect(boss().calls.length).toBeGreaterThan(0);
      expect(useDojoStore.getState().flashLevels[`${mapId}:6`]).toBe(3);
    }
  });

  it('a count check is asked before the second hand, and a wrong answer is graded', () => {
    boss().load(1, 6);
    boss().begin();
    expect(boss().status).toBe('play');
    expect(boss().hands).toBe(1);
    while (boss().status === 'play') {
      boss().act('stand');
    }
    expect(boss().status).toBe('result');
    boss().nextHand();
    expect(boss().status).toBe('question');
    const { correct } = boss().question!;
    expect(correct).toBe(boss().runningCount);
    expect(boss().answer(correct + 1)).toBe(false);
    expect(boss().calls).toEqual([{ kind: 'count', right: false }]);
    expect(boss().verdict?.right).toBe(false);
  });

  it('a leap from one unit to eight gets the player backed off with no stars', () => {
    boss().load(5, 6);
    boss().begin();
    expect(boss().status).toBe('bet');
    boss().placeBet(1);
    let guard = 0;
    while (boss().status !== 'bet' && boss().status !== 'done' && guard++ < 50) {
      const state = boss();
      if (state.status === 'insurance') state.decideInsurance(false);
      else if (state.status === 'play') state.act('stand');
      else if (state.status === 'result') state.nextHand();
      else if (state.status === 'question') state.answer(state.question!.correct);
    }
    expect(boss().status).toBe('bet');
    boss().placeBet(8);
    expect(boss().status).toBe('done');
    expect(boss().backedOff).toBe(true);
    expect(boss().stars).toBe(0);
    expect(useDojoStore.getState().flashLevels['5:6']).toBeUndefined();
  });
});
