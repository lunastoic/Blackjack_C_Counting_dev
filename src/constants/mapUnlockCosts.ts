/**
 * Chip price to open a casino early, before the previous casino's six
 * training levels are cleared — about 2.5× the casino before, rounded to a
 * figure that reads well. Luna Luxe (map 1) is always open, so it has no
 * price. Edit the numbers here; nothing else hard-codes them.
 */
export const MAP_UNLOCK_COSTS: Readonly<Record<number, number>> = {
  2: 100_000,
  3: 250_000,
  4: 625_000,
  5: 1_550_000,
  6: 3_900_000,
};

/** Price to buy `mapId` early, or null when the casino cannot be bought. */
export function mapUnlockCost(mapId: number): number | null {
  return MAP_UNLOCK_COSTS[mapId] ?? null;
}
