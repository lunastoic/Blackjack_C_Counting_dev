import { resolveRound } from '../../engine/blackjack/resolve';
import { activeHand, startRound } from '../../engine/blackjack/round';
import {
  DAILY_SHOE_CHIPS,
  dailyShoeSeed,
  expectedBet,
  expectedIndexPlay,
  handUnits,
  HEAT_LIMIT,
  heatAfterBet,
  scoreCalls,
  shoeRunStars,
  ShoeRunLevel,
  trainingLevelSpec,
} from '../../engine/dojo';
import { cardsRemaining } from '../../engine/shoe/shoe';
import { cardsOf, riggedShoe, seededRng } from '../../engine/testing/fixtures';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import { createDefaultSave } from '../../persistence/defaults';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { __setShoeRunRngForTests, useShoeRunStore } from '../../stores/shoeRunStore';
import { useWeakSpotsStore } from '../../stores/weakSpotsStore';
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

describe('daily shoe', () => {
  it('deals the same shuffle all day and a different one tomorrow', () => {
    const today = new Date(2026, 8, 17, 9).getTime();
    const firstCards = (now: number) => {
      boss().loadDaily(now);
      boss().begin();
      return boss().shoe!.cards.slice(0, 8).map((card) => card.id).join();
    };
    const morning = firstCards(today);
    expect(firstCards(today + 3_600_000)).toBe(morning);
    expect(dailyShoeSeed('2026-09-17')).not.toBe(dailyShoeSeed('2026-09-18'));
  });

  it('pays its chips once a day and keeps the best edge', () => {
    const dojo = () => useDojoStore.getState();
    const chips = () => useEconomyStore.getState().chips;
    const before = chips();
    expect(dojo().recordDailyShoe('2026-09-17', 1, 0.7, true)).toEqual({ edgeIsBest: false, chipsPaid: 0 });
    expect(dojo().recordDailyShoe('2026-09-17', 4, 0.9, false)).toEqual({ edgeIsBest: true, chipsPaid: DAILY_SHOE_CHIPS });
    expect(dojo().recordDailyShoe('2026-09-17', 2, 0.95, false)).toEqual({ edgeIsBest: false, chipsPaid: 0 });
    expect(chips()).toBe(before + DAILY_SHOE_CHIPS);
    expect(dojo().dailyShoe).toEqual({ dayKey: '2026-09-17', bestEdge: 4, bestAccuracy: 0.95, paid: true });
    // A new day starts clean and pays again.
    expect(dojo().recordDailyShoe('2026-09-18', -1, 0.5, false)).toEqual({ edgeIsBest: true, chipsPaid: DAILY_SHOE_CHIPS });
  });

  it('a daily run played through records the day, not a ladder level', () => {
    boss().loadDaily();
    boss().begin();
    let guard = 0;
    while (boss().status !== 'done' && guard++ < 1000) {
      const state = boss();
      if (state.status === 'question') state.answer(state.question!.correct);
      else if (state.status === 'bet') state.placeBet(1);
      else if (state.status === 'insurance') state.decideInsurance(false);
      else if (state.status === 'play') state.act('stand');
      else if (state.status === 'result') state.nextHand();
    }
    expect(boss().status).toBe('done');
    expect(boss().dailyResult).not.toBeNull();
    expect(useDojoStore.getState().dailyShoe.dayKey).toBe(boss().dayKey);
    expect(Object.keys(useDojoStore.getState().flashLevels)).toHaveLength(0);
  });
});

describe('beat the shoe — weak spots', () => {
  it('a missed index play on the exam lands in Weak Spots with its true count', () => {
    useWeakSpotsStore.getState().resetAll();
    boss().load(6, 6);
    boss().begin();
    let missed = false;
    let guard = 0;
    while (!missed && boss().status !== 'done' && guard++ < 1000) {
      const state = boss();
      const left = cardsRemaining(state.shoe!);
      if (state.status === 'question') state.answer(state.question!.correct);
      else if (state.status === 'bet') state.placeBet(1);
      else if (state.status === 'insurance') state.decideInsurance(false);
      else if (state.status === 'result') state.nextHand();
      else if (state.status === 'play') {
        const round = state.round!;
        const hand = activeHand(round)!;
        const expected =
          hand.cards.length === 2 && round.playerHands.length === 1
            ? expectedIndexPlay(hand.cards, round.dealerHand.cards[1].rank, state.runningCount, left, {
                canDouble: state.canAct('double'),
                canSplit: state.canAct('split'),
              })
            : null;
        if (expected) {
          state.act(expected === 'stand' ? 'hit' : 'stand');
          missed = true;
        } else {
          state.act('stand');
        }
      }
    }
    expect(missed).toBe(true);
    const [spot] = useWeakSpotsStore.getState().spots;
    expect(spot.reasonCode).toBe('INDEX_PLAY');
    expect(spot.trueCount).toEqual(expect.any(Number));
    expect(boss().calls.some((call) => call.kind === 'play' && !call.right)).toBe(true);
  });
});
