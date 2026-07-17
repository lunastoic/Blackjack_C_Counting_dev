import { MILESTONE_1_ACHIEVEMENTS } from '../../engine/achievements/definitions';
import {
  INITIAL_ACHIEVEMENTS_STATE,
  processEvent,
  processEvents,
  progressFor,
} from '../../engine/achievements/engine';
import { GameplayEvent } from '../../engine/achievements/events';
import { INITIAL_STATS } from '../../engine/achievements/stats';

const CATALOG = MILESTONE_1_ACHIEVEMENTS;

describe('lifetime stats accumulation', () => {
  it('counts hands, wins, pushes, losses, streaks, and no-bust streaks', () => {
    const events: GameplayEvent[] = [
      { type: 'HAND_COMPLETED', result: 'win', wasSplitHand: false, wasDoubled: false },
      { type: 'HAND_COMPLETED', result: 'blackjack', wasSplitHand: false, wasDoubled: false },
      { type: 'HAND_COMPLETED', result: 'push', wasSplitHand: false, wasDoubled: false },
      { type: 'HAND_COMPLETED', result: 'loss', wasSplitHand: false, wasDoubled: false, playerBusted: true },
      { type: 'PLAYER_BUST' },
    ];
    const { state } = processEvents(INITIAL_ACHIEVEMENTS_STATE, events, CATALOG);
    expect(state.stats.handsPlayed).toBe(4);
    expect(state.stats.wins).toBe(2);
    expect(state.stats.pushes).toBe(1);
    expect(state.stats.losses).toBe(1);
    expect(state.stats.bestWinStreak).toBe(2);
    expect(state.stats.currentWinStreak).toBe(0);
    expect(state.stats.bestConsecutiveBlackjacks).toBe(1);
    expect(state.stats.bestNoBustStreak).toBe(3);
  });

  it('tracks doubles, splits, busts, and dealer-bust wins', () => {
    const events: GameplayEvent[] = [
      { type: 'DOUBLE_USED' },
      { type: 'SPLIT_USED' },
      { type: 'PLAYER_BUST' },
      { type: 'DEALER_BUST_WIN' },
    ];
    const { state } = processEvents(INITIAL_ACHIEVEMENTS_STATE, events, CATALOG);
    expect(state.stats.doubles).toBe(1);
    expect(state.stats.splits).toBe(1);
    expect(state.stats.busts).toBe(1);
    expect(state.stats.dealerBustWins).toBe(1);
  });

  it('tracks peak running count and level as maxima', () => {
    const events: GameplayEvent[] = [
      { type: 'COUNT_REACHED', runningCount: 7 },
      { type: 'COUNT_REACHED', runningCount: 12 },
      { type: 'COUNT_REACHED', runningCount: 3 },
      { type: 'LEVEL_REACHED', level: 4 },
      { type: 'LEVEL_REACHED', level: 2 },
    ];
    const { state } = processEvents(INITIAL_ACHIEVEMENTS_STATE, events, CATALOG);
    expect(state.stats.highestRunningCount).toBe(12);
    expect(state.stats.highestLevel).toBe(4);
  });
});

describe('achievement progress', () => {
  it('reports progress toward a goal', () => {
    const { state } = processEvent(
      INITIAL_ACHIEVEMENTS_STATE,
      { type: 'COUNT_REACHED', runningCount: 6 },
      CATALOG,
    );
    const progress = progressFor(CATALOG.find((a) => a.id === 'count-above-10')!, state);
    expect(progress).toEqual({ id: 'count-above-10', current: 6, goal: 11, unlocked: false });
  });
});

describe('unlocks', () => {
  it('unlocks first-blackjack on the first natural', () => {
    const { state, newlyUnlocked } = processEvent(
      INITIAL_ACHIEVEMENTS_STATE,
      { type: 'BLACKJACK_HIT' },
      CATALOG,
    );
    expect(newlyUnlocked.map((u) => u.achievementId)).toEqual(['first-blackjack']);
    expect(state.unlockedIds).toContain('first-blackjack');
  });

  it('unlocks count-above-10 only when the count exceeds +10', () => {
    const at10 = processEvent(
      INITIAL_ACHIEVEMENTS_STATE,
      { type: 'COUNT_REACHED', runningCount: 10 },
      CATALOG,
    );
    expect(at10.newlyUnlocked).toHaveLength(0);

    const at11 = processEvent(at10.state, { type: 'COUNT_REACHED', runningCount: 11 }, CATALOG);
    expect(at11.newlyUnlocked.map((u) => u.achievementId)).toEqual(['count-above-10']);
  });

  it('unlocks reach-level-5 and first-all-in', () => {
    const { newlyUnlocked } = processEvents(
      INITIAL_ACHIEVEMENTS_STATE,
      [
        { type: 'LEVEL_REACHED', level: 5 },
        { type: 'ALL_IN_BET', amount: 500 },
      ],
      CATALOG,
    );
    expect(newlyUnlocked.map((u) => u.achievementId)).toEqual(['reach-level-5', 'first-all-in']);
  });

  it('never unlocks (or rewards) the same achievement twice', () => {
    const first = processEvent(INITIAL_ACHIEVEMENTS_STATE, { type: 'SPLIT_USED' }, CATALOG);
    expect(first.newlyUnlocked).toHaveLength(1);

    const second = processEvent(first.state, { type: 'SPLIT_USED' }, CATALOG);
    expect(second.newlyUnlocked).toHaveLength(0);
    expect(second.state.stats.splits).toBe(2); // stats still accumulate
    expect(second.state.unlockedIds.filter((id) => id === 'first-split')).toHaveLength(1);
  });

  it('does not mutate the input state', () => {
    processEvent(INITIAL_ACHIEVEMENTS_STATE, { type: 'DOUBLE_USED' }, CATALOG);
    expect(INITIAL_ACHIEVEMENTS_STATE.stats).toEqual(INITIAL_STATS);
    expect(INITIAL_ACHIEVEMENTS_STATE.unlockedIds).toEqual([]);
  });
});
