import { CASINO_MAPS } from '../../engine/betting/casino';
import {
  DAILY_GOAL_STREAK_CAP,
  DAILY_GOALS,
  dailyGoalMultiplier,
  dailyGoalReward,
  dayIndex,
  dayKey,
  goalForDay,
  liveStreak,
  previousDayKey,
  streakAfterClaim,
} from '../../engine/dojo/dailyGoal';
import { createDefaultSave } from '../../persistence/defaults';
import { useDailyGoalStore } from '../../stores/dailyGoalStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';

/** Local noon on a calendar day — safely inside the day in any zone. */
function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime();
}

/** First day from `start` whose goal is of the given kind. */
function dayWith(kind: (typeof DAILY_GOALS)[number]['kind'], start: number): number {
  for (let offset = 0; offset < DAILY_GOALS.length; offset++) {
    const now = start + offset * 86_400_000;
    if (goalForDay(dayKey(now)).kind === kind) {
      return now;
    }
  }
  throw new Error(`no ${kind} day`);
}

describe('daily goal — calendar', () => {
  it('keys days locally and steps back a day across month and year ends', () => {
    expect(dayKey(at(2026, 9, 9))).toBe('2026-09-09');
    expect(dayKey(at(2026, 9, 9, 0))).toBe('2026-09-09');
    expect(dayKey(at(2026, 9, 9, 23))).toBe('2026-09-09');
    expect(previousDayKey('2026-09-09')).toBe('2026-09-08');
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
    expect(dayIndex('2026-09-09') - dayIndex('2026-09-08')).toBe(1);
  });

  it('rotates through the three goals one a day', () => {
    const start = at(2026, 9, 9);
    const kinds = [0, 1, 2, 3].map((offset) => goalForDay(dayKey(start + offset * 86_400_000)).kind);
    expect(new Set(kinds.slice(0, 3)).size).toBe(3);
    expect(kinds[3]).toBe(kinds[0]);
    for (const goal of DAILY_GOALS) {
      expect(goal.target).toBeGreaterThan(0);
      expect(goal.title).toContain(String(goal.target));
    }
  });
});

describe('daily goal — pay-out', () => {
  it('multiplies 1× on day one up to 2× at the cap and no further', () => {
    expect(dailyGoalMultiplier(0)).toBe(1);
    expect(dailyGoalMultiplier(1)).toBe(1);
    expect(dailyGoalMultiplier(4)).toBe(1.5);
    expect(dailyGoalMultiplier(DAILY_GOAL_STREAK_CAP)).toBe(2);
    expect(dailyGoalMultiplier(DAILY_GOAL_STREAK_CAP + 5)).toBe(2);
  });

  it('pays 5% of the casino max bet, scaled by the streak, never under a chip', () => {
    expect(dailyGoalReward(1_000, 1)).toBe(50);
    expect(dailyGoalReward(1_000, 7)).toBe(100);
    expect(dailyGoalReward(10_000, 4)).toBe(750);
    expect(dailyGoalReward(1, 1)).toBe(1);
    for (const map of CASINO_MAPS) {
      expect(dailyGoalReward(map.maxBet, 1)).toBe(Math.round(map.maxBet * 0.05));
    }
  });

  it('extends a streak claimed yesterday and restarts one that lapsed', () => {
    expect(streakAfterClaim(0, null, '2026-09-09')).toBe(1);
    expect(streakAfterClaim(3, '2026-09-08', '2026-09-09')).toBe(4);
    expect(streakAfterClaim(3, '2026-09-07', '2026-09-09')).toBe(1);
    expect(liveStreak(3, '2026-09-09', '2026-09-09')).toBe(3);
    expect(liveStreak(3, '2026-09-08', '2026-09-09')).toBe(3);
    expect(liveStreak(3, '2026-09-07', '2026-09-09')).toBe(0);
    expect(liveStreak(0, null, '2026-09-09')).toBe(0);
  });
});

describe('daily goal store', () => {
  const store = () => useDailyGoalStore.getState();

  beforeEach(() => {
    const defaults = createDefaultSave();
    useEconomyStore.getState().hydrate({ ...defaults.economy, chips: 500 });
    useProgressionStore.getState().hydrate({ ...defaults.progression, unlockedMapIds: [1, 2] });
    store().hydrate(defaults.daily);
  });

  it('only counts notes that match the day’s goal', () => {
    const handsDay = dayWith('hands', at(2026, 9, 9));
    store().noteTrainingAnswer(handsDay);
    expect(store().progressToday(handsDay)).toBe(0);
    store().noteHand(false, handsDay);
    store().noteHand(true, handsDay);
    expect(store().progressToday(handsDay)).toBe(2);

    const winsDay = dayWith('wins', at(2026, 9, 9));
    store().noteHand(false, winsDay);
    expect(store().progressToday(winsDay)).toBe(0);
    store().noteHand(true, winsDay);
    expect(store().progressToday(winsDay)).toBe(1);

    const trainingDay = dayWith('training', at(2026, 9, 9));
    store().noteTrainingAnswer(trainingDay);
    store().noteTrainingAnswer(trainingDay);
    expect(store().progressToday(trainingDay)).toBe(2);
  });

  it('progress belongs to its day: a new day starts from scratch', () => {
    const day = dayWith('hands', at(2026, 9, 9));
    store().noteHand(false, day);
    expect(store().progressToday(day)).toBe(1);
    // Three days on, the same goal is up again; yesterday's count is gone.
    const later = day + 3 * 86_400_000;
    expect(store().progressToday(later)).toBe(0);
    store().noteHand(false, later);
    expect(store().progressToday(later)).toBe(1);
  });

  it('claims once a day, pays by the best casino open, and builds the streak day on day', () => {
    const day = dayWith('hands', at(2026, 9, 9));
    const target = store().goal(day).target;
    for (let n = 0; n < target - 1; n++) {
      store().noteHand(false, day);
    }
    expect(store().isClaimable(day)).toBe(false);
    expect(store().claim(day)).toBe(0);
    store().noteHand(false, day);
    expect(store().isClaimable(day)).toBe(true);

    // Map 2's max bet (5 000) → 250 chips on a fresh streak.
    expect(store().rewardToday(day)).toBe(250);
    expect(store().claim(day)).toBe(250);
    expect(useEconomyStore.getState().chips).toBe(750);
    expect(store().streakToday(day)).toBe(1);
    expect(store().isClaimed(day)).toBe(true);
    expect(store().isClaimable(day)).toBe(false);
    expect(store().claim(day)).toBe(0);

    // Tomorrow: the streak's second day pays more.
    const tomorrow = day + 86_400_000;
    const goal = store().goal(tomorrow);
    for (let n = 0; n < goal.target; n++) {
      if (goal.kind === 'training') {
        store().noteTrainingAnswer(tomorrow);
      } else {
        store().noteHand(true, tomorrow);
      }
    }
    expect(store().streakToday(tomorrow)).toBe(1);
    expect(store().rewardToday(tomorrow)).toBe(dailyGoalReward(5_000, 2));
    expect(store().claim(tomorrow)).toBe(dailyGoalReward(5_000, 2));
    expect(store().streakToday(tomorrow)).toBe(2);

    // Skip a day: the streak is gone and the next claim starts over.
    const dayAfterNext = tomorrow + 2 * 86_400_000;
    expect(store().streakToday(dayAfterNext)).toBe(0);
    expect(store().rewardToday(dayAfterNext)).toBe(250);
  });

  it('hydrates and survives a round trip', () => {
    store().hydrate({ dayKey: '2026-09-09', progress: 4, streak: 3, lastClaimedDayKey: '2026-09-08' });
    const day = at(2026, 9, 9);
    expect(store().progressToday(day)).toBe(4);
    expect(store().streakToday(day)).toBe(3);
    expect(store().isClaimed(day)).toBe(false);
  });
});
