import { createDefaultSave } from '../../persistence/defaults';
import {
  BROKE_REWARD_CHIPS,
  DAILY_REWARD_CHIPS,
  DAILY_REWARD_COOLDOWN_MS,
  useEconomyStore,
} from '../../stores/economyStore';

const NOW = 1_700_000_000_000;

function resetEconomy(chips = 500): void {
  useEconomyStore.getState().hydrate({
    ...createDefaultSave().economy,
    chips,
  });
}

describe('economy store', () => {
  beforeEach(() => resetEconomy());

  describe('credit and debit', () => {
    it('credits chips', () => {
      useEconomyStore.getState().creditChips(250);
      expect(useEconomyStore.getState().chips).toBe(750);
    });

    it('debits chips when affordable', () => {
      expect(useEconomyStore.getState().debitChips(200)).toBe(true);
      expect(useEconomyStore.getState().chips).toBe(300);
    });

    it('refuses debits above the balance — balance can never go negative', () => {
      expect(useEconomyStore.getState().debitChips(501)).toBe(false);
      expect(useEconomyStore.getState().chips).toBe(500);
    });

    it('can debit exactly to zero (all-in)', () => {
      expect(useEconomyStore.getState().debitChips(500)).toBe(true);
      expect(useEconomyStore.getState().chips).toBe(0);
    });

    it('ignores non-positive and non-integer amounts', () => {
      useEconomyStore.getState().creditChips(-100);
      useEconomyStore.getState().creditChips(0.5);
      expect(useEconomyStore.getState().debitChips(-5)).toBe(false);
      expect(useEconomyStore.getState().debitChips(2.5)).toBe(false);
      expect(useEconomyStore.getState().chips).toBe(500);
    });

    it('canAfford checks the balance', () => {
      expect(useEconomyStore.getState().canAfford(500)).toBe(true);
      expect(useEconomyStore.getState().canAfford(501)).toBe(false);
    });
  });

  describe('daily reward', () => {
    it('is available when never claimed', () => {
      expect(useEconomyStore.getState().isDailyRewardAvailable(NOW)).toBe(true);
      expect(useEconomyStore.getState().dailyRewardMsRemaining(NOW)).toBe(0);
    });

    it('claiming grants 500 chips and records the timestamp', () => {
      expect(useEconomyStore.getState().claimDailyReward(NOW)).toBe(true);
      expect(useEconomyStore.getState().chips).toBe(500 + DAILY_REWARD_CHIPS);
      expect(useEconomyStore.getState().dailyRewardClaimedAt).toBe(NOW);
    });

    it('prevents duplicate claims inside 24 hours', () => {
      useEconomyStore.getState().claimDailyReward(NOW);
      expect(useEconomyStore.getState().claimDailyReward(NOW + 1000)).toBe(false);
      expect(
        useEconomyStore.getState().claimDailyReward(NOW + DAILY_REWARD_COOLDOWN_MS - 1),
      ).toBe(false);
      expect(useEconomyStore.getState().chips).toBe(500 + DAILY_REWARD_CHIPS);
    });

    it('becomes claimable again after 24 hours', () => {
      useEconomyStore.getState().claimDailyReward(NOW);
      expect(
        useEconomyStore.getState().claimDailyReward(NOW + DAILY_REWARD_COOLDOWN_MS),
      ).toBe(true);
      expect(useEconomyStore.getState().chips).toBe(500 + 2 * DAILY_REWARD_CHIPS);
    });

    it('reports the countdown remaining', () => {
      useEconomyStore.getState().claimDailyReward(NOW);
      expect(useEconomyStore.getState().dailyRewardMsRemaining(NOW + 60_000)).toBe(
        DAILY_REWARD_COOLDOWN_MS - 60_000,
      );
    });
  });

  describe('broke (simulated-ad) reward', () => {
    it('is unavailable while the player still has chips', () => {
      useEconomyStore.getState().claimDailyReward(NOW);
      expect(useEconomyStore.getState().isBrokeRewardAvailable(NOW + 1000)).toBe(false);
    });

    it('is unavailable at zero chips while the daily reward is still claimable', () => {
      resetEconomy(0);
      expect(useEconomyStore.getState().isBrokeRewardAvailable(NOW)).toBe(false);
      expect(useEconomyStore.getState().claimBrokeReward(NOW)).toBe(false);
    });

    it('grants 1000 chips when broke AND daily is on cooldown', () => {
      useEconomyStore.getState().claimDailyReward(NOW);
      useEconomyStore.getState().debitChips(useEconomyStore.getState().chips);
      expect(useEconomyStore.getState().isBrokeRewardAvailable(NOW + 1000)).toBe(true);
      expect(useEconomyStore.getState().claimBrokeReward(NOW + 1000)).toBe(true);
      expect(useEconomyStore.getState().chips).toBe(BROKE_REWARD_CHIPS);
      expect(useEconomyStore.getState().adRewardClaimedAt).toBe(NOW + 1000);
    });

    it('cannot be claimed twice in a row (balance is no longer zero)', () => {
      useEconomyStore.getState().claimDailyReward(NOW);
      useEconomyStore.getState().debitChips(useEconomyStore.getState().chips);
      useEconomyStore.getState().claimBrokeReward(NOW + 1000);
      expect(useEconomyStore.getState().claimBrokeReward(NOW + 2000)).toBe(false);
      expect(useEconomyStore.getState().chips).toBe(BROKE_REWARD_CHIPS);
    });
  });

  it('hydrates from persisted data', () => {
    useEconomyStore.getState().hydrate({
      chips: 9999,
      lastBet: 50,
      dailyRewardClaimedAt: NOW,
      adRewardClaimedAt: null,
    });
    const state = useEconomyStore.getState();
    expect(state.chips).toBe(9999);
    expect(state.lastBet).toBe(50);
    expect(state.dailyRewardClaimedAt).toBe(NOW);
  });
});
