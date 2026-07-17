import { create } from 'zustand';
import { SaveData } from '../persistence/schema';

export const DAILY_REWARD_CHIPS = 500;
export const DAILY_REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const BROKE_REWARD_CHIPS = 1000;

/**
 * Chip economy. Reward cooldowns use device time for v1, which is not
 * tamper-resistant without a backend — documented and accepted for an
 * offline single-profile game.
 */
interface EconomyState {
  readonly chips: number;
  readonly lastBet: number;
  readonly dailyRewardClaimedAt: number | null;
  readonly adRewardClaimedAt: number | null;
  creditChips(amount: number): void;
  /** Returns false (and changes nothing) when the balance cannot cover it. */
  debitChips(amount: number): boolean;
  canAfford(amount: number): boolean;
  setLastBet(amount: number): void;
  isDailyRewardAvailable(now?: number): boolean;
  /** Milliseconds until the next daily claim; 0 when available. */
  dailyRewardMsRemaining(now?: number): number;
  /** Claims 500 chips. Returns false when still on cooldown (duplicate-claim protection). */
  claimDailyReward(now?: number): boolean;
  /** Simulated "watch ad": 1000 chips, only when broke AND daily is on cooldown. */
  isBrokeRewardAvailable(now?: number): boolean;
  claimBrokeReward(now?: number): boolean;
  hydrate(data: SaveData['economy']): void;
}

function isPositiveInteger(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

export const useEconomyStore = create<EconomyState>()((set, get) => ({
  chips: 0,
  lastBet: 0,
  dailyRewardClaimedAt: null,
  adRewardClaimedAt: null,

  creditChips: (amount) => {
    if (!isPositiveInteger(amount)) {
      return;
    }
    set((state) => ({ chips: state.chips + amount }));
  },

  debitChips: (amount) => {
    if (!isPositiveInteger(amount) || get().chips < amount) {
      return false;
    }
    set((state) => ({ chips: state.chips - amount }));
    return true;
  },

  canAfford: (amount) => Number.isInteger(amount) && amount >= 0 && get().chips >= amount,

  setLastBet: (amount) => {
    if (Number.isInteger(amount) && amount >= 0) {
      set({ lastBet: amount });
    }
  },

  isDailyRewardAvailable: (now = Date.now()) => get().dailyRewardMsRemaining(now) === 0,

  dailyRewardMsRemaining: (now = Date.now()) => {
    const claimedAt = get().dailyRewardClaimedAt;
    if (claimedAt === null) {
      return 0;
    }
    return Math.max(0, claimedAt + DAILY_REWARD_COOLDOWN_MS - now);
  },

  claimDailyReward: (now = Date.now()) => {
    if (!get().isDailyRewardAvailable(now)) {
      return false;
    }
    set((state) => ({
      chips: state.chips + DAILY_REWARD_CHIPS,
      dailyRewardClaimedAt: now,
    }));
    return true;
  },

  isBrokeRewardAvailable: (now = Date.now()) => {
    const state = get();
    return state.chips === 0 && !state.isDailyRewardAvailable(now);
  },

  claimBrokeReward: (now = Date.now()) => {
    if (!get().isBrokeRewardAvailable(now)) {
      return false;
    }
    set((state) => ({
      chips: state.chips + BROKE_REWARD_CHIPS,
      adRewardClaimedAt: now,
    }));
    return true;
  },

  hydrate: (data) =>
    set({
      chips: data.chips,
      lastBet: data.lastBet,
      dailyRewardClaimedAt: data.dailyRewardClaimedAt,
      adRewardClaimedAt: data.adRewardClaimedAt,
    }),
}));
