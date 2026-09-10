import { Rank } from '../../engine/cards/card';
import { dayKey, goalForDay } from '../../engine/dojo/dailyGoal';
import { cardsOf, riggedShoe } from '../../engine/testing/fixtures';
import { createDefaultSave } from '../../persistence/defaults';
import { useAchievementStore } from '../../stores/achievementStore';
import { useDailyGoalStore } from '../../stores/dailyGoalStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useModeStatsStore } from '../../stores/modeStatsStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { MAX_WEAK_SPOTS, useWeakSpotsStore, weakSpotKey } from '../../stores/weakSpotsStore';

/**
 * Strategy deviations: a hand played off-book raises a quiet notice on the
 * table and lands in the weak-spot log; a book play does neither. The
 * settled hand also feeds the daily goal. Shoes are rigged; timers are faked.
 */

function resetStores(chips = 500): void {
  useGameSessionStore.getState().endSession();
  const defaults = createDefaultSave();
  useEconomyStore.getState().hydrate({ ...defaults.economy, chips });
  useProgressionStore.getState().hydrate({
    ...defaults.progression,
    unlockedMapIds: [1, 2, 3],
    licenses: { '1': 'licensed', '2': 'licensed', '3': 'licensed' },
  });
  useAchievementStore.getState().hydrate(defaults.achievements, defaults.mapAchievements);
  useModeStatsStore.getState().hydrate(defaults.modeStats);
  useSettingsStore.getState().hydrate({ ...defaults.settings, countCoachLevel: 'full' });
  useWeakSpotsStore.getState().resetAll();
  useDailyGoalStore.getState().hydrate(defaults.daily);
}

/** Deal order is player, dealer hole, player, dealer up. */
function rig(...ranks: Rank[]): void {
  const filler = Array.from({ length: 30 }, () => '7' as Rank);
  useGameSessionStore.setState({ shoe: riggedShoe(cardsOf(...ranks, ...filler), 1) });
}

function session() {
  return useGameSessionStore.getState();
}

function dealRound(bet = 100): void {
  expect(session().addChipToBet(bet)).toBe(true);
  expect(session().deal()).toBe(true);
  jest.advanceTimersByTime(3500);
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStores();
  expect(session().startSession(1)).toBe(true);
});

afterEach(() => {
  session().endSession();
  jest.useRealTimers();
});

describe('deviation notices', () => {
  it('standing on hard 16 vs 10 raises the book play and logs the spot', () => {
    rig('10', '5', '6', '10');
    dealRound();
    expect(session().deviationNotice).toBeNull();
    expect(session().act('stand')).toBe(true);

    expect(session().deviationNotice).toMatchObject({
      chosen: 'stand',
      book: 'hit',
      situation: 'Hard 16 vs 10',
    });

    const spots = useWeakSpotsStore.getState().spots;
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      key: 'Hard 16|10|d-',
      dealerUpRank: '10',
      canDouble: true,
      canSplit: false,
      chosen: 'stand',
      book: 'hit',
      times: 1,
    });
    expect(spots[0].cards.map((card) => card.rank)).toEqual(['10', '6']);

    jest.runAllTimers();
    // The notice hangs around for the toast; the table can drop it.
    expect(session().deviationNotice).not.toBeNull();
    session().dismissDeviation();
    expect(session().deviationNotice).toBeNull();
  });

  it('a book play raises nothing', () => {
    rig('10', '10', '9', '8'); // hard 19 vs 8: stand
    dealRound();
    expect(session().act('stand')).toBe(true);
    expect(session().deviationNotice).toBeNull();
    expect(useWeakSpotsStore.getState().spots).toHaveLength(0);
  });

  it('hitting a pair of 8s vs 10 logs the split with the split option kept', () => {
    rig('8', '5', '8', '10');
    dealRound();
    expect(session().canAct('split')).toBe(true);
    expect(session().act('hit')).toBe(true);
    expect(session().deviationNotice).toMatchObject({ chosen: 'hit', book: 'split' });
    expect(useWeakSpotsStore.getState().spots[0]).toMatchObject({
      key: 'Pair of 8s|10|ds',
      canSplit: true,
      canDouble: true,
    });
  });

  it('the same slip twice bumps the count and each notice gets a new serial', () => {
    const serials: number[] = [];
    for (const expectedTimes of [1, 2]) {
      rig('10', '5', '6', '10');
      dealRound();
      expect(session().act('stand')).toBe(true);
      jest.runAllTimers();
      serials.push(session().deviationNotice!.serial);
      const spots = useWeakSpotsStore.getState().spots;
      expect(spots).toHaveLength(1);
      expect(spots[0].times).toBe(expectedTimes);
    }
    expect(serials[1]).toBe(serials[0] + 1);
  });

  it('a settled hand feeds the daily goal, autoplay aside', () => {
    // Land on a "play N hands" day so the note counts.
    const base = Date.now();
    const handsDay = [0, 1, 2]
      .map((offset) => base + offset * 86_400_000)
      .find((now) => goalForDay(dayKey(now)).kind === 'hands')!;
    jest.setSystemTime(handsDay);

    rig('10', '10', '9', '8');
    dealRound();
    expect(session().act('stand')).toBe(true);
    jest.runAllTimers();
    expect(useDailyGoalStore.getState().progressToday()).toBe(1);
  });
});

describe('weak spots store', () => {
  const store = () => useWeakSpotsStore.getState();
  const slip = (rank: Rank) => ({
    cards: [{ rank, suit: 'spades' as const }, { rank: '6' as const, suit: 'hearts' as const }],
    dealerUpRank: '10' as const,
    canDouble: true,
    canSplit: false,
    chosen: 'stand' as const,
    book: 'hit' as const,
    reasonCode: 'test',
  });

  it('keys a spot by its situation and options', () => {
    expect(weakSpotKey(slip('10'))).toBe('Hard 16|10|d-');
    expect(weakSpotKey({ ...slip('10'), canDouble: false })).toBe('Hard 16|10|--');
    expect(weakSpotKey({ ...slip('10'), dealerUpRank: 'A' })).toBe('Hard 16|A|d-');
  });

  it('keeps the newest first, bumps repeats, and clears on a right answer', () => {
    store().record(slip('10'), 1_000);
    store().record(slip('9'), 2_000);
    expect(store().spots.map((spot) => spot.key)).toEqual(['Hard 15|10|d-', 'Hard 16|10|d-']);
    store().record(slip('10'), 3_000);
    expect(store().spots.map((spot) => spot.key)).toEqual(['Hard 16|10|d-', 'Hard 15|10|d-']);
    expect(store().spots[0]).toMatchObject({ times: 2, lastAt: 3_000 });

    store().clear('Hard 16|10|d-');
    expect(store().spots.map((spot) => spot.key)).toEqual(['Hard 15|10|d-']);
    store().resetAll();
    expect(store().spots).toEqual([]);
  });

  it('caps the log at the newest entries', () => {
    const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let n = 0;
    for (const rank of ranks) {
      for (const dealerUpRank of ranks) {
        n += 1;
        store().record({ ...slip(rank), dealerUpRank }, n);
      }
    }
    expect(store().spots).toHaveLength(MAX_WEAK_SPOTS);
    expect(store().spots[0].lastAt).toBe(n);
  });

  it('hydrates from a save', () => {
    store().hydrate({ spots: [{ ...slip('10'), key: 'Hard 16|10|d-', times: 3, lastAt: 5 }] });
    expect(store().spots).toHaveLength(1);
    expect(store().spots[0].times).toBe(3);
  });
});
