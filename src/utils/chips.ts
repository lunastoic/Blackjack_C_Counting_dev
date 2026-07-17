/** Most chips ever drawn in one pile — bigger amounts read from the label. */
export const MAX_CHIPS_PER_STACK = 10;

/**
 * Greedy decomposition of an amount into physical casino chips (largest
 * denomination first), exactly like a dealer would cut out a payout. Any
 * sub-denomination remainder gets one smallest chip so the pile never looks
 * empty (labels always show the exact amount).
 */
export function decomposeChips(amount: number, denominations: readonly number[]): number[] {
  if (amount <= 0 || denominations.length === 0) {
    return [];
  }
  const sorted = [...denominations].sort((a, b) => b - a);
  const chips: number[] = [];
  let rest = amount;
  for (const denom of sorted) {
    while (rest >= denom && chips.length < MAX_CHIPS_PER_STACK) {
      chips.push(denom);
      rest -= denom;
    }
  }
  if (rest > 0 && chips.length < MAX_CHIPS_PER_STACK) {
    chips.push(sorted[sorted.length - 1]);
  }
  return chips;
}
