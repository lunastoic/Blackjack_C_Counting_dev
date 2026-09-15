/**
 * Chip price to open a casino early, before the previous casino's six
 * training levels are cleared. Luna Luxe (map 1) is always open, so it has
 * no price. Edit the numbers here; nothing else hard-codes them.
 */
export const MAP_UNLOCK_COSTS: Readonly<Record<number, number>> = {
  2: 125_000,
  3: 300_000,
  4: 600_000,
  5: 1_000_000,
  6: 2_000_000,
};

/** Price to buy `mapId` early, or null when the casino cannot be bought. */
export function mapUnlockCost(mapId: number): number | null {
  return MAP_UNLOCK_COSTS[mapId] ?? null;
}
