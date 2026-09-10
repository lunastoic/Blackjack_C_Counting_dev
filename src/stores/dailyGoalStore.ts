import { create } from 'zustand';
import { LUNA_LUXE, mapById } from '../engine/betting/casino';
import {
  DailyGoal,
  dailyGoalReward,
  dayKey,
  goalForDay,
  liveStreak,
  streakAfterClaim,
} from '../engine/dojo/dailyGoal';
import { SaveData } from '../persistence/schema';
import { useEconomyStore } from './economyStore';
import { useProgressionStore } from './progressionStore';

/**
 * Daily goal + day streak. One goal a day (they rotate), progress fed by the
 * table and the training levels, claimed on the Rewards screen for chips
 * that scale with the best casino open and double over a 7-day streak.
 *
 * Progress belongs to `dayKey`; a note on a later day starts over at 1. A
 * missed day quietly ends the streak — the next claim starts a new one.
 */
export interface DailyGoalState {
  /** The local day the progress belongs to ('' until the first note). */
  readonly dayKey: string;
  readonly progress: number;
  /** Consecutive days claimed, counting the last claim. */
  readonly streak: number;
  readonly lastClaimedDayKey: string | null;
  goal(now?: number): DailyGoal;
  /** Progress towards today's goal (0 when the stored progress is another day's). */
  progressToday(now?: number): number;
  /** The streak as it stands today: 0 once a whole day was missed. */
  streakToday(now?: number): number;
  /** Chips a claim right now would pay (streak included). */
  rewardToday(now?: number): number;
  isClaimed(now?: number): boolean;
  isClaimable(now?: number): boolean;
  /** A table hand settled (autoplay drills excluded by the caller). */
  noteHand(won: boolean, now?: number): void;
  /** A right answer on a training level. */
  noteTrainingAnswer(now?: number): void;
  /** Pays the reward and extends the streak. Returns the chips, 0 when not claimable. */
  claim(now?: number): number;
  hydrate(data: SaveData['daily']): void;
}

/** Max bet at the best casino the player has opened — what the reward scales with. */
function bestOpenMaxBet(): number {
  const ids = useProgressionStore.getState().unlockedMapIds;
  const best = mapById(Math.max(...ids));
  return (best ?? LUNA_LUXE).maxBet;
}

export const useDailyGoalStore = create<DailyGoalState>()((set, get) => {
  const bump = (kind: DailyGoal['kind'], now: number) => {
    const today = dayKey(now);
    if (get().goal(now).kind !== kind) {
      return;
    }
    set({ dayKey: today, progress: get().progressToday(now) + 1 });
  };

  return {
    dayKey: '',
    progress: 0,
    streak: 0,
    lastClaimedDayKey: null,

    goal: (now = Date.now()) => goalForDay(dayKey(now)),

    progressToday: (now = Date.now()) => (get().dayKey === dayKey(now) ? get().progress : 0),

    streakToday: (now = Date.now()) => liveStreak(get().streak, get().lastClaimedDayKey, dayKey(now)),

    rewardToday: (now = Date.now()) => {
      const { streak, lastClaimedDayKey } = get();
      const today = dayKey(now);
      const landing = lastClaimedDayKey === today ? streak : streakAfterClaim(streak, lastClaimedDayKey, today);
      return dailyGoalReward(bestOpenMaxBet(), landing);
    },

    isClaimed: (now = Date.now()) => get().lastClaimedDayKey === dayKey(now),

    isClaimable: (now = Date.now()) =>
      !get().isClaimed(now) && get().progressToday(now) >= get().goal(now).target,

    noteHand: (won, now = Date.now()) => {
      bump('hands', now);
      if (won) {
        bump('wins', now);
      }
    },

    noteTrainingAnswer: (now = Date.now()) => bump('training', now),

    claim: (now = Date.now()) => {
      if (!get().isClaimable(now)) {
        return 0;
      }
      const today = dayKey(now);
      const streak = streakAfterClaim(get().streak, get().lastClaimedDayKey, today);
      const reward = dailyGoalReward(bestOpenMaxBet(), streak);
      useEconomyStore.getState().creditChips(reward);
      set({ streak, lastClaimedDayKey: today });
      return reward;
    },

    hydrate: (data) =>
      set({
        dayKey: data.dayKey,
        progress: data.progress,
        streak: data.streak,
        lastClaimedDayKey: data.lastClaimedDayKey,
      }),
  };
});
