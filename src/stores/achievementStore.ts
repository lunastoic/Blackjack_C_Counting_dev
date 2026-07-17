import { create } from 'zustand';
import { AchievementProgress } from '../engine/achievements/definitions';
import {
  AchievementUnlockEvent,
  processEvent,
  progressFor,
} from '../engine/achievements/engine';
import { GameplayEvent } from '../engine/achievements/events';
import { MAP_ACHIEVEMENTS, MAP_IDS, MapAchievementDefinition } from '../engine/achievements/mapDefinitions';
import { INITIAL_STATS, LifetimeStats } from '../engine/achievements/stats';
import { SaveData } from '../persistence/schema';

export interface AchievementListItem {
  readonly definition: MapAchievementDefinition;
  readonly progress: AchievementProgress;
}

export interface MapAchievementSummary {
  readonly mapId: number;
  readonly unlocked: number;
  readonly total: number;
}

interface MapAchievementSlice {
  readonly stats: LifetimeStats;
  readonly unlockedIds: readonly string[];
}

function emptyMapSlices(): Record<number, MapAchievementSlice> {
  const slices: Record<number, MapAchievementSlice> = {};
  for (const mapId of MAP_IDS) {
    slices[mapId] = { stats: { ...INITIAL_STATS }, unlockedIds: [] };
  }
  return slices;
}

/**
 * Global lifetime stats plus per-casino achievement progress. Map-scoped
 * unlocks are tracked separately so each table has its own 12 achievements.
 */
interface AchievementState {
  readonly stats: LifetimeStats;
  readonly mapSlices: Record<number, MapAchievementSlice>;
  readonly pendingUnlocks: readonly AchievementUnlockEvent[];
  applyEvent(event: GameplayEvent, mapId?: number): readonly AchievementUnlockEvent[];
  dismissUnlock(achievementId: string): void;
  progressList(mapId: number): AchievementListItem[];
  mapSummary(mapId: number): MapAchievementSummary;
  allMapSummaries(): readonly MapAchievementSummary[];
  totalUnlocked(): number;
  hydrate(data: SaveData['achievements'], mapData: SaveData['mapAchievements']): void;
}

function unlockFromCatalog(
  stats: LifetimeStats,
  unlockedIds: readonly string[],
  catalog: readonly MapAchievementDefinition[],
): { unlockedIds: string[]; newlyUnlocked: AchievementUnlockEvent[] } {
  const nextIds = [...unlockedIds];
  const newlyUnlocked: AchievementUnlockEvent[] = [];
  for (const definition of catalog) {
    if (nextIds.includes(definition.id)) {
      continue;
    }
    if (stats[definition.statKey] >= definition.goal) {
      nextIds.push(definition.id);
      newlyUnlocked.push({
        achievementId: definition.id,
        title: definition.title,
        description: definition.description,
      });
    }
  }
  return { unlockedIds: nextIds, newlyUnlocked };
}

export const useAchievementStore = create<AchievementState>()((set, get) => ({
  stats: INITIAL_STATS,
  mapSlices: emptyMapSlices(),
  pendingUnlocks: [],

  applyEvent: (event, mapId) => {
    const globalResult = processEvent(
      { stats: get().stats, unlockedIds: [] },
      event,
      [],
    );
    const slices = { ...get().mapSlices };
    let newlyUnlocked: AchievementUnlockEvent[] = [];

    if (mapId !== undefined) {
      const slice = slices[mapId] ?? { stats: { ...INITIAL_STATS }, unlockedIds: [] };
      const mapResult = processEvent({ stats: slice.stats, unlockedIds: [] }, event, []);
      const mapCatalog = MAP_ACHIEVEMENTS.filter((item) => item.mapId === mapId);
      const mapUnlock = unlockFromCatalog(mapResult.state.stats, slice.unlockedIds, mapCatalog);
      slices[mapId] = { stats: mapResult.state.stats, unlockedIds: mapUnlock.unlockedIds };
      newlyUnlocked = mapUnlock.newlyUnlocked;
    }

    set((state) => ({
      stats: globalResult.state.stats,
      mapSlices: slices,
      pendingUnlocks: [...state.pendingUnlocks, ...newlyUnlocked],
    }));
    return newlyUnlocked;
  },

  dismissUnlock: (achievementId) =>
    set((state) => ({
      pendingUnlocks: state.pendingUnlocks.filter((u) => u.achievementId !== achievementId),
    })),

  progressList: (mapId) => {
    const slice = get().mapSlices[mapId] ?? { stats: INITIAL_STATS, unlockedIds: [] };
    const catalog = MAP_ACHIEVEMENTS.filter((item) => item.mapId === mapId);
    return catalog.map((definition) => ({
      definition,
      progress: progressFor(definition, { stats: slice.stats, unlockedIds: slice.unlockedIds }),
    }));
  },

  mapSummary: (mapId) => {
    const slice = get().mapSlices[mapId];
    const total = MAP_ACHIEVEMENTS.filter((item) => item.mapId === mapId).length;
    return {
      mapId,
      unlocked: slice?.unlockedIds.length ?? 0,
      total,
    };
  },

  allMapSummaries: () => MAP_IDS.map((mapId) => get().mapSummary(mapId)),

  totalUnlocked: () =>
    MAP_IDS.reduce((sum, mapId) => sum + (get().mapSlices[mapId]?.unlockedIds.length ?? 0), 0),

  hydrate: (data, mapData) => {
    const slices = emptyMapSlices();
    for (const [key, value] of Object.entries(mapData)) {
      const mapId = Number(key);
      if (!MAP_IDS.includes(mapId)) {
        continue;
      }
      slices[mapId] = {
        stats: { ...value.stats },
        unlockedIds: [...value.unlockedIds],
      };
    }
    set({
      stats: { ...data.stats },
      mapSlices: slices,
      pendingUnlocks: [],
    });
  },
}));
