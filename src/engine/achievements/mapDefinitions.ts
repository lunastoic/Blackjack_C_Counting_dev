import { CASINO_MAPS, CasinoMap } from '../betting/casino';
import { LifetimeStats } from './stats';

/** Per-casino achievement tied to map-scoped lifetime stats. */
export interface MapAchievementDefinition {
  readonly id: string;
  readonly mapId: number;
  readonly title: string;
  readonly description: string;
  readonly statKey: keyof LifetimeStats;
  readonly goal: number;
}

interface AchievementBlueprint {
  readonly suffix: string;
  readonly title: string;
  readonly description: string;
  readonly statKey: keyof LifetimeStats;
  readonly goalForMap: (map: CasinoMap) => number;
}

/** Twelve blackjack-themed goals per casino; thresholds scale with table stakes. */
const BLUEPRINTS: readonly AchievementBlueprint[] = [
  {
    suffix: 'first-hand',
    title: 'First Felt',
    description: 'Play your first hand at this table.',
    statKey: 'handsPlayed',
    goalForMap: () => 1,
  },
  {
    suffix: 'first-blackjack',
    title: 'Natural Winner',
    description: 'Hit a natural blackjack here.',
    statKey: 'blackjacks',
    goalForMap: () => 1,
  },
  {
    suffix: 'first-double',
    title: 'Double Down',
    description: 'Double down for the first time at this casino.',
    statKey: 'doubles',
    goalForMap: () => 1,
  },
  {
    suffix: 'first-split',
    title: 'Split the Pair',
    description: 'Split a pair at this table.',
    statKey: 'splits',
    goalForMap: () => 1,
  },
  {
    suffix: 'back-to-back-bj',
    title: 'Back-to-Back Blackjacks',
    description: 'Land two natural blackjacks in a row.',
    statKey: 'bestConsecutiveBlackjacks',
    goalForMap: () => 2,
  },
  {
    suffix: 'no-bust-streak',
    title: 'Cool Hand',
    description: 'Finish 10 hands in a row without busting.',
    statKey: 'bestNoBustStreak',
    goalForMap: (map) => (map.id <= 2 ? 10 : map.id <= 4 ? 12 : 15),
  },
  {
    suffix: 'win-streak',
    title: 'On Fire',
    description: 'Win five hands in a row at this table.',
    statKey: 'bestWinStreak',
    goalForMap: (map) => (map.id <= 2 ? 5 : map.id <= 4 ? 6 : 7),
  },
  {
    suffix: 'dealer-bust-wins',
    title: 'Dealer Bust Beatdown',
    description: 'Win when the dealer busts multiple times.',
    statKey: 'dealerBustWins',
    goalForMap: (map) => Math.max(3, map.id * 2),
  },
  {
    suffix: 'hot-shoe',
    title: 'Hot Shoe',
    description: 'Reach a strong positive running count here.',
    statKey: 'highestRunningCount',
    goalForMap: (map) => 4 + map.id * 2,
  },
  {
    suffix: 'table-veteran',
    title: 'Table Veteran',
    description: 'Grind out many hands at this casino.',
    statKey: 'handsPlayed',
    goalForMap: (map) => map.id * 25,
  },
  {
    suffix: 'split-wins',
    title: 'Split Specialist',
    description: 'Win multiple split hands at this table.',
    statKey: 'splitWins',
    goalForMap: (map) => Math.max(2, map.id + 1),
  },
  {
    suffix: 'double-wins',
    title: 'Double Winner',
    description: 'Win after doubling down here.',
    statKey: 'doubleWins',
    goalForMap: (map) => Math.max(2, map.id + 1),
  },
  {
    suffix: 'high-roller',
    title: 'High Roller',
    description: 'Place a large bet at this casino.',
    statKey: 'highestBet',
    goalForMap: (map) => Math.max(map.chipDenominations[map.chipDenominations.length - 1] * 2, map.maxBet / 10),
  },
];

const MAP_THEME_PREFIX: Record<number, string> = {
  1: 'Moonlight',
  2: 'Inferno',
  3: 'Glacier',
  4: 'Orbital',
  5: 'Titan',
  6: 'Kepler',
};

function themedTitle(map: CasinoMap, base: string): string {
  const prefix = MAP_THEME_PREFIX[map.id] ?? map.name;
  if (base === 'First Felt') {
    return `${prefix} Debut`;
  }
  if (base === 'Natural Winner') {
    return `${prefix} Natural`;
  }
  if (base === 'Hot Shoe') {
    return `${prefix} Hot Shoe`;
  }
  if (base === 'High Roller') {
    return `${prefix} High Roller`;
  }
  return base;
}

function buildForMap(map: CasinoMap): MapAchievementDefinition[] {
  return BLUEPRINTS.map((blueprint) => ({
    id: `map${map.id}-${blueprint.suffix}`,
    mapId: map.id,
    title: themedTitle(map, blueprint.title),
    description: blueprint.description,
    statKey: blueprint.statKey,
    goal: blueprint.goalForMap(map),
  }));
}

/** Full catalog: 13 unique blackjack achievements per casino (78 total). */
export const ACHIEVEMENTS_PER_MAP = BLUEPRINTS.length;

export const MAP_ACHIEVEMENTS: readonly MapAchievementDefinition[] = CASINO_MAPS.flatMap(buildForMap);

export function achievementsForMap(mapId: number): readonly MapAchievementDefinition[] {
  return MAP_ACHIEVEMENTS.filter((item) => item.mapId === mapId);
}

export const MAP_IDS = CASINO_MAPS.map((map) => map.id);
