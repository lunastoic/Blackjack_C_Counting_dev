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
    it('Luna Luxe and Io Inferno are open by default, tables included; the rest are locked', () => {
      for (const id of [1, 2]) {
        expect(useProgressionStore.getState().isMapUnlocked(id)).toBe(true);
        expect(useProgressionStore.getState().licenseForMap(id)).toBe('licensed');
      }
      // Open is not earned: the ladder still records Io Inferno in order.
      expect(useProgressionStore.getState().unlockedMapIds).toEqual([1]);
      for (const id of [3, 4, 5, 6]) {
        expect(useProgressionStore.getState().isMapUnlocked(id)).toBe(false);
        expect(useProgressionStore.getState().licenseForMap(id)).toBe('none');
      }
    });

    it('every locked casino can be opened, each only once', () => {
      expect(useProgressionStore.getState().canUnlockMap(3)).toBe(true);
      expect(useProgressionStore.getState().canUnlockMap(4)).toBe(true);
      expect(useProgressionStore.getState().canUnlockMap(1)).toBe(false); // already open
      expect(useProgressionStore.getState().canUnlockMap(2)).toBe(false); // never locked

      expect(useProgressionStore.getState().unlockMap(3)).toBe(true);
      expect(useProgressionStore.getState().isMapUnlocked(3)).toBe(true);
      expect(useProgressionStore.getState().unlockMap(3)).toBe(false); // once
      expect(useProgressionStore.getState().canUnlockMap(3)).toBe(false);
      // An always-open casino is still recorded as earned once its turn comes — without a reveal.
      expect(useProgressionStore.getState().unlockMap(2)).toBe(true);
      expect(useProgressionStore.getState().unlockedMapIds).toEqual([1, 3, 2]);
      expect(useProgressionStore.getState().pendingRevealMapId).toBe(3);
      expect(useProgressionStore.getState().unlockMap(2)).toBe(false); // once
    });

    it('opens the table with the casino', () => {
      expect(useProgressionStore.getState().licenseForMap(3)).toBe('none');
      useProgressionStore.getState().unlockMap(3);
      expect(useProgressionStore.getState().licenseForMap(3)).toBe('licensed');
    });

    it('queues a one-time reveal for the Select Map screen when a casino unlocks', () => {
      expect(useProgressionStore.getState().pendingRevealMapId).toBeNull();
      useProgressionStore.getState().unlockMap(3);
      expect(useProgressionStore.getState().pendingRevealMapId).toBe(3);

      useProgressionStore.getState().clearMapReveal();
      expect(useProgressionStore.getState().pendingRevealMapId).toBeNull();
      // The reveal is not part of the save.
      expect(useProgressionStore.getState().unlockMap(3)).toBe(false);
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
        2: 100_000,
        3: 250_000,
        4: 625_000,
        5: 1_550_000,
        6: 3_900_000,
      });
      // Each casino costs about 2.5× the one before.
      for (const id of [3, 4, 5, 6]) {
        const ratio = MAP_UNLOCK_COSTS[id] / MAP_UNLOCK_COSTS[id - 1];
        expect(ratio).toBeGreaterThan(2.4);
        expect(ratio).toBeLessThan(2.6);
      }
      expect(mapUnlockCost(1)).toBeNull();
      expect(mapUnlockCost(2)).toBe(100_000);
      expect(mapUnlockCost(99)).toBeNull();
    });

    it('debits the price once and opens the casino, its table and its reveal', () => {
      useEconomyStore.setState({ chips: 255_000 });
      expect(store().buyMap(3)).toBe(true);
      expect(chips()).toBe(5_000);
      expect(store().isMapUnlocked(3)).toBe(true);
      expect(store().licenseForMap(3)).toBe('licensed');
      expect(store().pendingRevealMapId).toBe(3);
    });

    it('refuses when short on chips and leaves everything untouched', () => {
      useEconomyStore.setState({ chips: 249_999 });
      expect(store().buyMap(3)).toBe(false);
      expect(chips()).toBe(249_999);
      expect(store().isMapUnlocked(3)).toBe(false);
      expect(store().licenseForMap(3)).toBe('none');
      expect(store().pendingRevealMapId).toBeNull();
    });

    it('never charges twice for a casino that is already open', () => {
      useEconomyStore.setState({ chips: 300_000 });
      // Io Inferno was never locked, so it is never for sale.
      expect(store().buyMap(2)).toBe(false);
      expect(chips()).toBe(300_000);
      expect(store().buyMap(3)).toBe(true);
      expect(store().buyMap(3)).toBe(false);
      expect(chips()).toBe(50_000);

      // An earned unlock is not for sale either.
      store().unlockMap(4);
      expect(store().buyMap(4)).toBe(false);
      expect(chips()).toBe(50_000);
    });

    it('sells any locked casino, in any order; Luna Luxe never', () => {
      useEconomyStore.setState({ chips: 10_000_000 });
      expect(store().buyMap(1)).toBe(false);
      expect(chips()).toBe(10_000_000);

      // Skipping ahead is allowed — the price climbs for it.
      expect(store().buyMap(6)).toBe(true);
      expect(store().isMapUnlocked(6)).toBe(true);
      expect(store().isMapUnlocked(3)).toBe(false);
      expect(store().buyMap(3)).toBe(true);
      expect(chips()).toBe(10_000_000 - 3_900_000 - 250_000);
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
      useEconomyStore.setState({ chips: 250_000 });

      expect(store().buyMap(3)).toBe(true);

      expect(useDojoStore.getState().flashLevels).toEqual(before.flashLevels);
      expect(useDojoStore.getState().nextFlashLevel(1)).toBe(4);
      expect(useDojoStore.getState().isFlashLevelUnlocked(3, 1)).toBe(true);
      expect(store().level).toBe(before.level);
      expect(store().xpIntoLevel).toBe(before.xpIntoLevel);
      expect(useDojoStore.getState().totalDojoXp).toBe(before.totalDojoXp);
      expect(chips()).toBe(0);
    });

    it('a bought casino still opens the next one for free once its ladder is cleared', () => {
      useEconomyStore.setState({ chips: 250_000 });
      useDojoStore.getState().hydrate(createDefaultSave().dojo);
      expect(store().buyMap(3)).toBe(true);
      for (let level = 1; level <= 6; level++) {
        useDojoStore.getState().completeTrainingLevel(3, level, 2);
      }
      expect(store().isMapUnlocked(4)).toBe(true);
      expect(store().licenseForMap(4)).toBe('licensed');
      expect(useEconomyStore.getState().chips).toBeGreaterThan(0); // star chips only
    });
  });

  describe('table licenses', () => {
    it('closed tables upgrade none → permit → licensed', () => {
      const store = () => useProgressionStore.getState();
      expect(store().licenseForMap(3)).toBe('none');

      expect(store().grantLicense(3, 'permit')).toBe(true);
      expect(store().licenseForMap(3)).toBe('permit');

      expect(store().grantLicense(3, 'licensed')).toBe(true);
      expect(store().licenseForMap(3)).toBe('licensed');
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
        unlockedMapIds: [1, 3],
        licenses: { '1': 'licensed', '3': 'permit' },
      });
      expect(useProgressionStore.getState().licenseForMap(1)).toBe('licensed');
      expect(useProgressionStore.getState().licenseForMap(2)).toBe('licensed'); // always open
      expect(useProgressionStore.getState().licenseForMap(3)).toBe('permit');
      expect(useProgressionStore.getState().licenseForMap(4)).toBe('none');
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
