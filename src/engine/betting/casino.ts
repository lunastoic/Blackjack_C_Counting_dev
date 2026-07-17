/**
 * Casino map data (REBUILD_SPEC §8). Pure data — artwork keys resolve to real
 * assets in later milestones. Kepler's themed chip art does not exist yet; it
 * uses the Titan denominations pending the owner decision recorded in
 * docs/IMPLEMENTATION_PLAN.md.
 */
export interface CasinoMap {
  readonly id: number;
  readonly name: string;
  readonly unlockLevel: number;
  readonly maxBet: number;
  readonly chipDenominations: readonly number[];
  readonly chipSetKey: string;
  readonly feltKey: string;
  readonly artKey: string;
}

export const STARTING_BANKROLL = 500;

export const CASINO_MAPS: readonly CasinoMap[] = [
  {
    id: 1,
    name: 'Luna Luxe Casino',
    unlockLevel: 1,
    maxBet: 1_000,
    chipDenominations: [1, 5, 25, 50, 100],
    chipSetKey: 'default',
    feltKey: 'gray-suede',
    artKey: 'luna-luxe',
  },
  {
    id: 2,
    name: 'Io Inferno Lounge',
    unlockLevel: 5,
    maxBet: 5_000,
    chipDenominations: [5, 25, 50, 250, 500],
    chipSetKey: 'inferno',
    feltKey: 'orange-suede',
    artKey: 'inferno',
  },
  {
    id: 3,
    name: 'Europa Ice Palace',
    unlockLevel: 10,
    maxBet: 10_000,
    chipDenominations: [25, 50, 100, 500, 1000],
    chipSetKey: 'europa',
    feltKey: 'blue-suede',
    artKey: 'europa',
  },
  {
    id: 4,
    name: 'Ganymede Grand',
    unlockLevel: 15,
    maxBet: 50_000,
    chipDenominations: [100, 250, 500, 2500, 5000],
    chipSetKey: 'ganymede',
    feltKey: 'purple-suede',
    artKey: 'ganymede',
  },
  {
    id: 5,
    name: 'Titan Methane Mirage',
    unlockLevel: 20,
    maxBet: 250_000,
    chipDenominations: [250, 1000, 2500, 10000, 25000],
    chipSetKey: 'titan',
    feltKey: 'green-suede',
    artKey: 'titan',
  },
  {
    id: 6,
    name: 'Kepler Fortune',
    unlockLevel: 25,
    maxBet: 1_000_000,
    chipDenominations: [250, 1000, 2500, 10000, 25000],
    chipSetKey: 'titan',
    feltKey: 'yellow-suede',
    artKey: 'kepler',
  },
];

export const LUNA_LUXE: CasinoMap = CASINO_MAPS[0];

export function mapById(id: number): CasinoMap | undefined {
  return CASINO_MAPS.find((map) => map.id === id);
}
