import { ACHIEVEMENTS_PER_MAP, MAP_ACHIEVEMENTS } from '../../engine/achievements/mapDefinitions';
import { createDefaultSave } from '../../persistence/defaults';
import { useAchievementStore } from '../../stores/achievementStore';
import { recordGameplayEvent } from '../../stores/orchestration';

function resetAchievements(): void {
  const save = createDefaultSave();
  useAchievementStore.getState().hydrate(save.achievements, save.mapAchievements);
}

describe('achievement store', () => {
  beforeEach(resetAchievements);

  it('updates lifetime stats from gameplay events', () => {
    recordGameplayEvent(
      {
        type: 'HAND_COMPLETED',
        result: 'win',
        wasSplitHand: false,
        wasDoubled: false,
      },
      1,
    );
    recordGameplayEvent(
      {
        type: 'HAND_COMPLETED',
        result: 'loss',
        wasSplitHand: false,
        wasDoubled: false,
      },
      1,
    );
    const stats = useAchievementStore.getState().stats;
    expect(stats.handsPlayed).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
  });

  it('tracks per-map stats separately from global stats', () => {
    recordGameplayEvent(
      {
        type: 'HAND_COMPLETED',
        result: 'win',
        wasSplitHand: false,
        wasDoubled: false,
      },
      1,
    );
    recordGameplayEvent(
      {
        type: 'HAND_COMPLETED',
        result: 'win',
        wasSplitHand: false,
        wasDoubled: false,
      },
      2,
    );
    expect(useAchievementStore.getState().mapSlices[1].stats.handsPlayed).toBe(1);
    expect(useAchievementStore.getState().mapSlices[2].stats.handsPlayed).toBe(1);
    expect(useAchievementStore.getState().stats.handsPlayed).toBe(2);
  });

  it('unlocks a map achievement when the goal is reached and queues a notification', () => {
    const unlocked = useAchievementStore.getState().applyEvent({ type: 'DOUBLE_USED' }, 1);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].achievementId).toBe('map1-first-double');
    expect(useAchievementStore.getState().mapSlices[1].unlockedIds).toContain('map1-first-double');
    expect(useAchievementStore.getState().pendingUnlocks).toHaveLength(1);
  });

  it('never unlocks the same map achievement twice', () => {
    useAchievementStore.getState().applyEvent({ type: 'SPLIT_USED' }, 1);
    const second = useAchievementStore.getState().applyEvent({ type: 'SPLIT_USED' }, 1);
    expect(second).toHaveLength(0);
    expect(
      useAchievementStore.getState().mapSlices[1].unlockedIds.filter((id) => id === 'map1-first-split'),
    ).toHaveLength(1);
    expect(useAchievementStore.getState().mapSlices[1].stats.splits).toBe(2);
  });

  it('dismissUnlock removes only the dismissed notification', () => {
    useAchievementStore.getState().applyEvent({ type: 'DOUBLE_USED' }, 1);
    useAchievementStore.getState().applyEvent({ type: 'SPLIT_USED' }, 1);
    expect(useAchievementStore.getState().pendingUnlocks).toHaveLength(2);
    useAchievementStore.getState().dismissUnlock('map1-first-double');
    const pending = useAchievementStore.getState().pendingUnlocks;
    expect(pending).toHaveLength(1);
    expect(pending[0].achievementId).toBe('map1-first-split');
  });

  it('progressList exposes twelve achievements for a casino with progress', () => {
    useAchievementStore.getState().applyEvent({ type: 'COUNT_REACHED', runningCount: 7 }, 1);
    const list = useAchievementStore.getState().progressList(1);
    expect(list).toHaveLength(ACHIEVEMENTS_PER_MAP);
    const hotShoe = list.find((item) => item.definition.id === 'map1-hot-shoe')!;
    expect(hotShoe.progress.current).toBe(6);
    expect(hotShoe.progress.goal).toBe(6);
    expect(hotShoe.progress.unlocked).toBe(true);
  });

  it('hydration restores global and per-map progress but clears the transient queue', () => {
    useAchievementStore.getState().applyEvent({ type: 'DOUBLE_USED' }, 1);
    const savedAchievements = {
      stats: { ...useAchievementStore.getState().stats },
      unlockedIds: [],
    };
    const savedMapAchievements = Object.fromEntries(
      Object.entries(useAchievementStore.getState().mapSlices).map(([mapId, slice]) => [
        mapId,
        { stats: { ...slice.stats }, unlockedIds: [...slice.unlockedIds] },
      ]),
    );
    resetAchievements();
    useAchievementStore.getState().hydrate(savedAchievements, savedMapAchievements);
    expect(useAchievementStore.getState().stats.doubles).toBe(1);
    expect(useAchievementStore.getState().mapSlices[1].unlockedIds).toContain('map1-first-double');
    expect(useAchievementStore.getState().pendingUnlocks).toHaveLength(0);
  });

  it('ships seventy-eight map achievements across six casinos', () => {
    expect(MAP_ACHIEVEMENTS).toHaveLength(78);
    expect(new Set(MAP_ACHIEVEMENTS.map((item) => item.id)).size).toBe(78);
  });
});
