import { DeckCount } from '../shoe/shoe';

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
  /** Quiz Mode flash-time multiplier: Luna Luxe drills slowest (1.5×), each
   *  casino up the ladder deals faster, Kepler runs at full speed (1.0×). */
  readonly quizPaceMultiplier: number;
  /** Decks in this casino's shoe (tables AND quiz): 1 at Luna Luxe up to 8. */
  readonly deckCount: DeckCount;
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
    deckCount: 1,
    quizPaceMultiplier: 1.5,
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
    deckCount: 2,
    quizPaceMultiplier: 1.4,
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
    deckCount: 4,
    quizPaceMultiplier: 1.3,
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
    deckCount: 6,
    quizPaceMultiplier: 1.2,
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
    deckCount: 8,
    quizPaceMultiplier: 1.1,
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
    deckCount: 8,
    quizPaceMultiplier: 1.0,
  },
];

export const LUNA_LUXE: CasinoMap = CASINO_MAPS[0];

export function mapById(id: number): CasinoMap | undefined {
  return CASINO_MAPS.find((map) => map.id === id);
}

/**
 * Table licenses — earned in the Count Sprint, per casino:
 *   none      the table is closed; the quiz is the way in
 *   permit    3 circles in a row: play opens with a reduced bet cap
 *   licensed  a full 9/9 cycle: full max bet
 */
export type TableLicense = 'none' | 'permit' | 'licensed';

/** Streak needed in the Count Sprint for a table permit. */
export const PERMIT_STREAK = 3;

/** Permit bet cap: a tenth of the table max, never below the smallest chip. */
export function permitMaxBet(map: CasinoMap): number {
  return Math.max(map.chipDenominations[0], Math.floor(map.maxBet / 10));
}

/** The bet ceiling a license tier actually allows at this casino. */
export function maxBetForLicense(map: CasinoMap, license: TableLicense): number {
  return license === 'licensed' ? map.maxBet : permitMaxBet(map);
}
