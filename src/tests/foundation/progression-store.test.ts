import { MAP_UNLOCK_COSTS, mapUnlockCost } from '../../constants/mapUnlockCosts';
import { CHIPS_PER_LEVEL_UP, MAX_LEVEL, XP_PER_LEVEL } from '../../engine/progression/progression';
import { createDefaultSave } from '../../persistence/defaults';
import { useAchievementStore } from '../../stores/achievementStore';
import { useDojoStore } from '../../stores/dojoStore';
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
    it('only Luna Luxe is unlocked by default, with its table open', () => {
      expect(useProgressionStore.getState().isMapUnlocked(1)).toBe(true);
      expect(useProgressionStore.getState().licenseForMap(1)).toBe('licensed');
      for (const id of [2, 3, 4, 5, 6]) {
        expect(useProgressionStore.getState().isMapUnlocked(id)).toBe(false);
        expect(useProgressionStore.getState().licenseForMap(id)).toBe('none');
      }
    });

    it('casinos open in order: the next one only, regardless of level', () => {
      expect(useProgressionStore.getState().canUnlockMap(2)).toBe(true);
      expect(useProgressionStore.getState().canUnlockMap(3)).toBe(false);
      expect(useProgressionStore.getState().unlockMap(3)).toBe(false);

      expect(useProgressionStore.getState().unlockMap(2)).toBe(true);
      expect(useProgressionStore.getState().isMapUnlocked(2)).toBe(true);
      expect(useProgressionStore.getState().unlockMap(2)).toBe(false); // once
      expect(useProgressionStore.getState().canUnlockMap(3)).toBe(true);
    });

    it('opens the table with the casino', () => {
      useProgressionStore.getState().unlockMap(2);
      expect(useProgressionStore.getState().licenseForMap(2)).toBe('licensed');
    });

    it('queues a one-time reveal for the Select Map screen when a casino unlocks', () => {
      expect(useProgressionStore.getState().pendingRevealMapId).toBeNull();
      useProgressionStore.getState().unlockMap(2);
      expect(useProgressionStore.getState().pendingRevealMapId).toBe(2);

      useProgressionStore.getState().clearMapReveal();
      expect(useProgressionStore.getState().pendingRevealMapId).toBeNull();
      // The reveal is not part of the save.
      expect(useProgressionStore.getState().unlockMap(2)).toBe(false);
      expect(useProgressionStore.getState().pendingRevealMapId).toBeNull();
    });

    it('rejects unknown map ids', () => {
      expect(useProgressionStore.getState().unlockMap(99)).toBe(false);
    });
  });

  describe('buying the next casino', () => {
    const store = () => useProgressionStore.getState();
    const chips = () => useEconomyStore.getState().chips;

    it('prices follow the constants table; Luna Luxe is never for sale', () => {
      expect(MAP_UNLOCK_COSTS).toEqual({
        2: 125_000,
        3: 300_000,
        4: 600_000,
        5: 1_000_000,
        6: 2_000_000,
      });
      expect(mapUnlockCost(1)).toBeNull();
      expect(mapUnlockCost(2)).toBe(125_000);
      expect(mapUnlockCost(99)).toBeNull();
    });

    it('debits the price once and opens the casino, its table and its reveal', () => {
      useEconomyStore.setState({ chips: 130_000 });
      expect(store().buyMap(2)).toBe(true);
      expect(chips()).toBe(5_000);
      expect(store().isMapUnlocked(2)).toBe(true);
      expect(store().licenseForMap(2)).toBe('licensed');
      expect(store().pendingRevealMapId).toBe(2);
    });

    it('refuses when short on chips and leaves everything untouched', () => {
      useEconomyStore.setState({ chips: 124_999 });
      expect(store().buyMap(2)).toBe(false);
      expect(chips()).toBe(124_999);
      expect(store().isMapUnlocked(2)).toBe(false);
      expect(store().licenseForMap(2)).toBe('none');
      expect(store().pendingRevealMapId).toBeNull();
    });

    it('never charges twice for a casino that is already open', () => {
      useEconomyStore.setState({ chips: 300_000 });
      expect(store().buyMap(2)).toBe(true);
      expect(store().buyMap(2)).toBe(false);
      expect(chips()).toBe(175_000);

      // An earned unlock is not for sale either.
      store().unlockMap(3);
      expect(store().buyMap(3)).toBe(false);
      expect(chips()).toBe(175_000);
    });

    it('sells casinos in order only', () => {
      useEconomyStore.setState({ chips: 10_000_000 });
      expect(store().buyMap(3)).toBe(false);
      expect(store().buyMap(1)).toBe(false);
      expect(chips()).toBe(10_000_000);

      expect(store().buyMap(2)).toBe(true);
      expect(store().buyMap(3)).toBe(true);
      expect(chips()).toBe(10_000_000 - 125_000 - 300_000);
    });

    it('only buys access: the previous casino\'s ladder, stars and XP stay put', () => {
      useDojoStore.getState().hydrate(createDefaultSave().dojo);
      const dojo = useDojoStore.getState();
      dojo.completeTrainingLevel(1, 1, 3);
      dojo.completeTrainingLevel(1, 2, 3);
      dojo.completeTrainingLevel(1, 3, 2);
      const before = {
        flashLevels: { ...useDojoStore.getState().flashLevels },
        level: store().level,
        xpIntoLevel: store().xpIntoLevel,
        totalDojoXp: useDojoStore.getState().totalDojoXp,
      };
      useEconomyStore.setState({ chips: 125_000 });

      expect(store().buyMap(2)).toBe(true);

      expect(useDojoStore.getState().flashLevels).toEqual(before.flashLevels);
      expect(useDojoStore.getState().nextFlashLevel(1)).toBe(4);
      expect(useDojoStore.getState().isFlashLevelUnlocked(2, 1)).toBe(true);
      expect(store().level).toBe(before.level);
      expect(store().xpIntoLevel).toBe(before.xpIntoLevel);
      expect(useDojoStore.getState().totalDojoXp).toBe(before.totalDojoXp);
      expect(chips()).toBe(0);
    });

    it('a bought casino still opens the next one for free once its ladder is cleared', () => {
      useEconomyStore.setState({ chips: 125_000 });
      useDojoStore.getState().hydrate(createDefaultSave().dojo);
      expect(store().buyMap(2)).toBe(true);
      for (let level = 1; level <= 6; level++) {
        useDojoStore.getState().completeTrainingLevel(2, level, 2);
      }
      expect(store().isMapUnlocked(3)).toBe(true);
      expect(store().licenseForMap(3)).toBe('licensed');
      expect(useEconomyStore.getState().chips).toBeGreaterThan(0); // star chips only
    });
  });

  describe('table licenses', () => {
    it('closed tables upgrade none → permit → licensed', () => {
      const store = () => useProgressionStore.getState();
      expect(store().licenseForMap(2)).toBe('none');

      expect(store().grantLicense(2, 'permit')).toBe(true);
      expect(store().licenseForMap(2)).toBe('permit');

      expect(store().grantLicense(2, 'licensed')).toBe(true);
      expect(store().licenseForMap(2)).toBe('licensed');
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
