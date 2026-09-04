import { CHIPS_PER_LEVEL_UP, MAX_LEVEL, XP_PER_LEVEL } from '../../engine/progression/progression';
import { createDefaultSave } from '../../persistence/defaults';
import { useAchievementStore } from '../../stores/achievementStore';
import { useEconomyStore } from '../../stores/economyStore';
import { awardXpWithRewards } from '../../stores/orchestration';
import { useProgressionStore } from '../../stores/progressionStore';

function resetStores(): void {
  const defaults = createDefaultSave();
  useProgressionStore.getState().hydrate(defaults.progression);
  useEconomyStore.getState().hydrate(defaults.economy);
  useAchievementStore.getState().hydrate(defaults.achievements, defaults.mapAchievements);
}

describe('progression store', () => {
  beforeEach(resetStores);

  it('accumulates XP using the engine math', () => {
    const result = useProgressionStore.getState().awardXp(10);
    expect(result.newLevel).toBe(1);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(10);
  });

  it('levels up at 30 XP and reports the chip reward', () => {
    const result = useProgressionStore.getState().awardXp(XP_PER_LEVEL + 5);
    expect(result.newLevel).toBe(2);
    expect(result.chipReward).toBe(CHIPS_PER_LEVEL_UP);
    expect(useProgressionStore.getState().level).toBe(2);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(5);
  });

  it('discards XP beyond the level cap', () => {
    useProgressionStore.getState().hydrate({
      level: MAX_LEVEL,
      xpIntoLevel: 0,
      unlockedMapIds: [1],
      licenses: {},
    });
    const result = useProgressionStore.getState().awardXp(100);
    expect(result.levelsGained).toBe(0);
    expect(result.chipReward).toBe(0);
    expect(useProgressionStore.getState().level).toBe(MAX_LEVEL);
    expect(useProgressionStore.getState().xpIntoLevel).toBe(0);
  });

  describe('map unlocks', () => {
    it('only Luna Luxe is unlocked by default', () => {
      expect(useProgressionStore.getState().isMapUnlocked(1)).toBe(true);
      for (const id of [2, 3, 4, 5, 6]) {
        expect(useProgressionStore.getState().isMapUnlocked(id)).toBe(false);
      }
    });

    it('refuses to unlock before the previous casino is fully licensed', () => {
      expect(useProgressionStore.getState().canUnlockMap(2)).toBe(false);
      expect(useProgressionStore.getState().unlockMap(2)).toBe(false);

      // A permit is not enough — the ladder needs the full 9/9 license.
      useProgressionStore.getState().grantLicense(1, 'permit');
      expect(useProgressionStore.getState().unlockMap(2)).toBe(false);
    });

    it('unlocks the next casino once the previous license lands, regardless of level', () => {
      useProgressionStore.getState().hydrate({
        level: 1, // levels no longer gate casinos — they only pay chip rewards
        xpIntoLevel: 0,
        unlockedMapIds: [1],
        licenses: { '1': 'licensed' },
      });
      expect(useProgressionStore.getState().canUnlockMap(2)).toBe(true);
      expect(useProgressionStore.getState().unlockMap(2)).toBe(true);
      expect(useProgressionStore.getState().isMapUnlocked(2)).toBe(true);
      expect(useProgressionStore.getState().unlockMap(2)).toBe(false); // once

      // Map 3 still needs Io Inferno's license.
      expect(useProgressionStore.getState().unlockMap(3)).toBe(false);
    });

    it('rejects unknown map ids', () => {
      expect(useProgressionStore.getState().unlockMap(99)).toBe(false);
    });
  });

  describe('table licenses', () => {
    it('starts with every table closed and upgrades none → permit → licensed', () => {
      const store = () => useProgressionStore.getState();
      expect(store().licenseForMap(1)).toBe('none');

      expect(store().grantLicense(1, 'permit')).toBe(true);
      expect(store().licenseForMap(1)).toBe('permit');

      expect(store().grantLicense(1, 'licensed')).toBe(true);
      expect(store().licenseForMap(1)).toBe('licensed');
    });

    it('never downgrades, re-grants, or licenses unknown maps', () => {
      const store = () => useProgressionStore.getState();
      store().grantLicense(1, 'licensed');

      expect(store().grantLicense(1, 'licensed')).toBe(false); // no re-grant
      expect(store().grantLicense(1, 'permit')).toBe(false); // no downgrade
      expect(store().licenseForMap(1)).toBe('licensed');
      expect(store().grantLicense(99, 'permit')).toBe(false); // unknown map
    });

    it('round-trips through hydrate', () => {
      useProgressionStore.getState().hydrate({
        level: 5,
        xpIntoLevel: 0,
        unlockedMapIds: [1, 2],
        licenses: { '1': 'licensed', '2': 'permit' },
      });
      expect(useProgressionStore.getState().licenseForMap(1)).toBe('licensed');
      expect(useProgressionStore.getState().licenseForMap(2)).toBe('permit');
      expect(useProgressionStore.getState().licenseForMap(3)).toBe('none');
    });
  });
});

describe('XP orchestration (awardXpWithRewards)', () => {
  beforeEach(resetStores);

  it('credits level-up chips to the economy store', () => {
    const before = useEconomyStore.getState().chips;
    const outcome = awardXpWithRewards(XP_PER_LEVEL);
    expect(outcome.progression.levelsGained).toBe(1);
    expect(useEconomyStore.getState().chips).toBe(before + CHIPS_PER_LEVEL_UP);
  });

  it('does not touch the economy without a level-up', () => {
    const before = useEconomyStore.getState().chips;
    awardXpWithRewards(3);
    expect(useEconomyStore.getState().chips).toBe(before);
  });

  it('feeds LEVEL_REACHED into global lifetime stats', () => {
    const outcome = awardXpWithRewards(XP_PER_LEVEL * 4);
    expect(outcome.progression.newLevel).toBe(5);
    expect(useAchievementStore.getState().stats.highestLevel).toBe(5);
    expect(outcome.unlocked).toHaveLength(0);
  });
});
