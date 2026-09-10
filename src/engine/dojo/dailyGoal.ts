/**
 * Daily goal — one small target a day, paid in chips that scale with the
 * best casino the player has opened, with a day streak that doubles the
 * pay-out over a week. Pure math; the store keeps the progress.
 */

export type DailyGoalKind = 'hands' | 'training' | 'wins';

export interface DailyGoal {
  readonly kind: DailyGoalKind;
  readonly target: number;
  readonly title: string;
  /** Where the progress comes from, for the Rewards card. */
  readonly hint: string;
}

/** The three goals, in the order they rotate day by day. */
export const DAILY_GOALS: readonly DailyGoal[] = [
  { kind: 'hands', target: 15, title: 'Play 15 hands', hint: 'Any casino table counts.' },
  { kind: 'training', target: 30, title: 'Get 30 right in training', hint: 'Right answers on any training level.' },
  { kind: 'wins', target: 5, title: 'Win 5 hands', hint: 'Blackjacks count too. Pushes do not.' },
];

/** Share of the best open casino's max bet the goal pays before the streak. */
export const DAILY_GOAL_REWARD_SHARE = 0.05;

/** Streak length at which the pay-out reaches its 2× ceiling. */
export const DAILY_GOAL_STREAK_CAP = 7;

const MS_PER_DAY = 86_400_000;

/** Local calendar day as "YYYY-MM-DD" — the key everything daily hangs on. */
export function dayKey(now: number = Date.now()): string {
  const date = new Date(now);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days since the epoch for a day key (calendar math, no time zones). */
export function dayIndex(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function previousDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day) - MS_PER_DAY);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${previous.getUTCFullYear()}-${pad(previous.getUTCMonth() + 1)}-${pad(previous.getUTCDate())}`;
}

/** The goal on a given day: the three rotate, one after the other. */
export function goalForDay(key: string): DailyGoal {
  const index = dayIndex(key) % DAILY_GOALS.length;
  return DAILY_GOALS[(index + DAILY_GOALS.length) % DAILY_GOALS.length];
}

/** 1× on day one of a streak, climbing evenly to 2× at the cap. */
export function dailyGoalMultiplier(streak: number): number {
  const day = Math.min(Math.max(streak, 1), DAILY_GOAL_STREAK_CAP);
  return 1 + (day - 1) / (DAILY_GOAL_STREAK_CAP - 1);
}

/**
 * Chips for finishing the goal: 5% of the max bet at the best casino open,
 * times the streak multiplier. `streak` is the streak the claim lands on
 * (1 for a fresh start), never below one chip.
 */
export function dailyGoalReward(maxBet: number, streak: number): number {
  const base = Math.round(maxBet * DAILY_GOAL_REWARD_SHARE);
  return Math.max(1, Math.round(base * dailyGoalMultiplier(streak)));
}

/**
 * The streak a claim on `todayKey` would land on: one more than the running
 * streak when yesterday was claimed, otherwise back to one.
 */
export function streakAfterClaim(streak: number, lastClaimedDayKey: string | null, todayKey: string): number {
  return lastClaimedDayKey === previousDayKey(todayKey) ? streak + 1 : 1;
}

/**
 * The streak as it stands today: intact while today or yesterday was
 * claimed, gone (0) once a whole day was missed.
 */
export function liveStreak(streak: number, lastClaimedDayKey: string | null, todayKey: string): number {
  if (lastClaimedDayKey === todayKey || lastClaimedDayKey === previousDayKey(todayKey)) {
    return streak;
  }
  return 0;
}
