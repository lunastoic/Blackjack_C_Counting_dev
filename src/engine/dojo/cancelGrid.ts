import { Card, hiLoValue, makeCard, Rank, Suit } from '../cards/card';
import { defaultRng, fisherYatesShuffle, Rng } from '../shoe/rng';

/**
 * Cancel Out — Luna Luxe's level 2. A grid of face-up cards; drag a card onto
 * the nearest card in any of the eight directions and, if one is +1 and the
 * other −1, both vanish. A 7, 8 or 9 is already 0: tap it to clear it. Once
 * no pair is left, whatever remains is all one sign and the player calls its
 * count (some grids clear to nothing and need no call).
 *
 * "Nearest" skips gaps: the neighbour to the right is the first card to the
 * right, however far. If the board ever has both signs left but no pair in
 * reach (and nothing neutral to tap), it regroups the cards into a tight
 * block — a block with both signs always has a pair touching.
 *
 * Pure TypeScript — no React / RN imports.
 */

export interface GridCell {
  /** Stable for the life of the grid, so the board can animate a card. */
  readonly id: number;
  readonly card: Card;
  /** Hi-Lo value: +1, 0 or −1. */
  readonly value: number;
}

export interface CancelGrid {
  readonly rows: number;
  readonly cols: number;
  /** Row-major; null where a card has been cleared. */
  readonly cells: readonly (GridCell | null)[];
}

export interface GridSpec {
  readonly rows: number;
  readonly cols: number;
  /** Most cards of one sign that may be left over at the end (0 = always clears). */
  readonly maxLeftover: number;
}

const PLUS_RANKS: readonly Rank[] = ['2', '3', '4', '5', '6'];
const ZERO_RANKS: readonly Rank[] = ['7', '8', '9'];
const MINUS_RANKS: readonly Rank[] = ['10', 'J', 'Q', 'K', 'A'];
const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Roughly a quarter of a grid is 7s, 8s and 9s — something to tap between pairs. */
const NEUTRAL_SHARE = 0.25;

function pick<T>(list: readonly T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)];
}

function cardOf(value: number, rng: Rng): Card {
  const ranks = value > 0 ? PLUS_RANKS : value < 0 ? MINUS_RANKS : ZERO_RANKS;
  return makeCard(pick(ranks, rng), pick(SUITS, rng));
}

/**
 * A fresh grid. The signed cards outnumber each other by at most
 * `maxLeftover`; the rest are neutrals. Shuffled into place.
 */
export function makeCancelGrid(spec: GridSpec, rng: Rng = defaultRng): CancelGrid {
  const total = spec.rows * spec.cols;
  const leftover =
    spec.maxLeftover > 0
      ? (1 + Math.floor(rng() * spec.maxLeftover)) * (rng() < 0.5 ? 1 : -1)
      : 0;
  let neutrals = Math.round(total * NEUTRAL_SHARE);
  // Plus and minus cards must split the rest evenly around the leftover.
  if ((total - neutrals - Math.abs(leftover)) % 2 !== 0) {
    neutrals += 1;
  }
  const signed = total - neutrals;
  const pairs = (signed - Math.abs(leftover)) / 2;
  const plus = pairs + Math.max(0, leftover);
  const minus = pairs + Math.max(0, -leftover);

  const values = [
    ...Array.from({ length: plus }, () => 1),
    ...Array.from({ length: minus }, () => -1),
    ...Array.from({ length: neutrals }, () => 0),
  ];
  const cells = fisherYatesShuffle(values, rng).map((value, id) => {
    const card = cardOf(value, rng);
    return { id, card, value: hiLoValue(card.rank) };
  });
  return { rows: spec.rows, cols: spec.cols, cells };
}

export function cellAt(grid: CancelGrid, row: number, col: number): GridCell | null {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) {
    return null;
  }
  return grid.cells[row * grid.cols + col];
}

export function positionOf(grid: CancelGrid, id: number): { row: number; col: number } | null {
  const index = grid.cells.findIndex((cell) => cell?.id === id);
  return index === -1 ? null : { row: Math.floor(index / grid.cols), col: index % grid.cols };
}

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** The nearest card in each of the eight directions, gaps skipped. */
export function neighbours(grid: CancelGrid, id: number): GridCell[] {
  const at = positionOf(grid, id);
  if (!at) {
    return [];
  }
  const found: GridCell[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    let row = at.row + dr;
    let col = at.col + dc;
    while (row >= 0 && col >= 0 && row < grid.rows && col < grid.cols) {
      const cell = cellAt(grid, row, col);
      if (cell) {
        found.push(cell);
        break;
      }
      row += dr;
      col += dc;
    }
  }
  return found;
}

/** Whether the two cards are in reach of each other. */
export function areNeighbours(grid: CancelGrid, a: number, b: number): boolean {
  return neighbours(grid, a).some((cell) => cell.id === b);
}

export function remaining(grid: CancelGrid): GridCell[] {
  return grid.cells.filter((cell): cell is GridCell => cell !== null);
}

/** Sum of the cards still on the board — the call at the end. */
export function remainingCount(grid: CancelGrid): number {
  return remaining(grid).reduce((sum, cell) => sum + cell.value, 0);
}

/** A +1 and a −1 that touch: a move exists. */
export function hasPairInReach(grid: CancelGrid): boolean {
  return remaining(grid).some(
    (cell) => cell.value !== 0 && neighbours(grid, cell.id).some((other) => other.value === -cell.value),
  );
}

/** Nothing left to cancel or tap: only one sign (or nothing) remains. */
export function isSettled(grid: CancelGrid): boolean {
  const left = remaining(grid);
  const hasPlus = left.some((cell) => cell.value > 0);
  const hasMinus = left.some((cell) => cell.value < 0);
  const hasZero = left.some((cell) => cell.value === 0);
  return !hasZero && !(hasPlus && hasMinus);
}

/** Packs the cards that are left into the top-left, in reading order. */
export function regroup(grid: CancelGrid): CancelGrid {
  const left = remaining(grid);
  const cells: (GridCell | null)[] = Array.from({ length: grid.rows * grid.cols }, (_, index) =>
    index < left.length ? left[index] : null,
  );
  return { ...grid, cells };
}

/** Both signs left, nothing neutral to tap, and no pair in reach: the board needs regrouping. */
export function needsRegroup(grid: CancelGrid): boolean {
  const left = remaining(grid);
  const hasPlus = left.some((cell) => cell.value > 0);
  const hasMinus = left.some((cell) => cell.value < 0);
  const hasZero = left.some((cell) => cell.value === 0);
  return hasPlus && hasMinus && !hasZero && !hasPairInReach(grid);
}

function without(grid: CancelGrid, ids: readonly number[]): CancelGrid {
  const cells = grid.cells.map((cell) => (cell && ids.includes(cell.id) ? null : cell));
  const next = { ...grid, cells };
  return needsRegroup(next) ? regroup(next) : next;
}

export type CancelResult =
  | { readonly ok: true; readonly grid: CancelGrid }
  | { readonly ok: false; readonly reason: 'notNeighbours' | 'noCancel' };

/**
 * Drop card `from` on card `to`. A +1 and a −1 in reach of each other both
 * clear. A drop that doesn't cancel is a miss.
 */
export function cancelPair(grid: CancelGrid, from: number, to: number): CancelResult {
  const a = remaining(grid).find((cell) => cell.id === from);
  const b = remaining(grid).find((cell) => cell.id === to);
  if (!a || !b || a.id === b.id) {
    return { ok: false, reason: 'notNeighbours' };
  }
  if (a.value === 0 || a.value + b.value !== 0) {
    return { ok: false, reason: 'noCancel' };
  }
  if (!areNeighbours(grid, from, to)) {
    return { ok: false, reason: 'notNeighbours' };
  }
  return { ok: true, grid: without(grid, [from, to]) };
}

/** Tap a card: a 7, 8 or 9 clears. Tapping a +1 or −1 is a miss. */
export function clearNeutral(grid: CancelGrid, id: number): CancelResult {
  const cell = remaining(grid).find((entry) => entry.id === id);
  if (!cell) {
    return { ok: false, reason: 'notNeighbours' };
  }
  if (cell.value !== 0) {
    return { ok: false, reason: 'noCancel' };
  }
  return { ok: true, grid: without(grid, [id]) };
}
