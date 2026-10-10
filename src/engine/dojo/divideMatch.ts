import { defaultRng, fisherYatesShuffle, Rng } from '../shoe/rng';
import { trueCountFromDecks } from './training';

/**
 * Divide and Match — Europa Ice's level 2. A grid of tiles: half are running
 * counts (+6, +9 …), half are decks left (2 decks, 1½ decks …), and a target
 * true count sits on top. Drag any count onto any deck tile; if the count ÷
 * the decks, rounded down, is the target, both clear. Any other pair is a
 * miss.
 *
 * The board can always be cleared, whatever valid pairs the player makes:
 * every count tile divides to the target with exactly ONE of the deck values
 * on the board, and each deck value has as many count tiles as deck tiles.
 * Any valid pair removes one of each from the same value, so the rest stays
 * balanced.
 *
 * Pure TypeScript — no React / RN imports.
 */

export type DivideTileKind = 'count' | 'deck';

export interface DivideTile {
  /** Stable for the life of the grid. */
  readonly id: number;
  readonly kind: DivideTileKind;
  /** A running count, or decks left. */
  readonly value: number;
}

export interface DivideGrid {
  readonly rows: number;
  readonly cols: number;
  /** The true count every pair has to make. */
  readonly target: number;
  /** Row-major; null where a tile has been cleared. */
  readonly cells: readonly (DivideTile | null)[];
}

export interface DivideGridSpec {
  readonly rows: number;
  readonly cols: number;
  /** Deck tiles run up to this many decks. */
  readonly maxDecks: number;
  /** Deck tiles may be halves (½, 1½ …). */
  readonly halfDecks: boolean;
}

/** Targets are whole true counts from +1 to +4. */
export const DIVIDE_TARGETS: readonly number[] = [1, 2, 3, 4];

/** Whether a running count over these decks makes the target true count. */
export function isDivideMatch(count: number, decks: number, target: number): boolean {
  return trueCountFromDecks(count, decks) === target;
}

/** Every deck value the level allows, smallest first. */
export function deckValues(maxDecks: number, halfDecks: boolean): number[] {
  const values: number[] = [];
  const step = halfDecks ? 0.5 : 1;
  for (let decks = step; decks <= maxDecks + 1e-9; decks += step) {
    values.push(Math.round(decks * 2) / 2);
  }
  return values;
}

/** Running counts that make `target` over `decks` and over no other deck value in `present`. */
export function uniqueCounts(target: number, decks: number, present: readonly number[]): number[] {
  const counts: number[] = [];
  const low = Math.ceil(target * decks);
  const high = Math.ceil((target + 1) * decks) - 1;
  for (let count = Math.max(1, low); count <= high; count++) {
    if (!isDivideMatch(count, decks, target)) {
      continue;
    }
    const elsewhere = present.some((other) => other !== decks && isDivideMatch(count, other, target));
    if (!elsewhere) {
      counts.push(count);
    }
  }
  return counts;
}

function pick<T>(list: readonly T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)];
}

/**
 * A fresh grid. Picks a target and two to four deck values whose counts can
 * each be told apart, then deals matched pairs spread across those values
 * and shuffles them into place. An odd cell count leaves the last cell empty.
 */
export function makeDivideGrid(spec: DivideGridSpec, rng: Rng = defaultRng): DivideGrid {
  const pairs = Math.floor((spec.rows * spec.cols) / 2);
  const all = deckValues(spec.maxDecks, spec.halfDecks);

  for (let attempt = 0; attempt < 200; attempt++) {
    const target = pick(DIVIDE_TARGETS, rng);
    const wanted = Math.min(all.length, 2 + Math.floor(rng() * 3));
    const present = fisherYatesShuffle(all, rng).slice(0, wanted);
    if (present.some((decks) => uniqueCounts(target, decks, present).length === 0)) {
      continue;
    }

    const tiles: Omit<DivideTile, 'id'>[] = [];
    for (let pair = 0; pair < pairs; pair++) {
      // Every value gets at least one pair; the rest go anywhere.
      const decks = pair < present.length ? present[pair] : pick(present, rng);
      const count = pick(uniqueCounts(target, decks, present), rng);
      tiles.push({ kind: 'count', value: count }, { kind: 'deck', value: decks });
    }
    const placed = fisherYatesShuffle(tiles, rng).map((tile, id) => ({ id, ...tile }));
    const cells: (DivideTile | null)[] = Array.from({ length: spec.rows * spec.cols }, (_, index) =>
      index < placed.length ? placed[index] : null,
    );
    return { rows: spec.rows, cols: spec.cols, target, cells };
  }
  throw new Error('Could not deal a divide-and-match grid');
}

export function remainingTiles(grid: DivideGrid): DivideTile[] {
  return grid.cells.filter((cell): cell is DivideTile => cell !== null);
}

export function tileById(grid: DivideGrid, id: number): DivideTile | null {
  return grid.cells.find((cell) => cell?.id === id) ?? null;
}

export function divideCellAt(grid: DivideGrid, row: number, col: number): DivideTile | null {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) {
    return null;
  }
  return grid.cells[row * grid.cols + col];
}

/** Nothing left on the board. */
export function isGridClear(grid: DivideGrid): boolean {
  return remainingTiles(grid).length === 0;
}

/** Some count tile and deck tile still make the target. */
export function hasDivideMatch(grid: DivideGrid): boolean {
  const left = remainingTiles(grid);
  const decks = left.filter((tile) => tile.kind === 'deck');
  return left.some(
    (tile) =>
      tile.kind === 'count' && decks.some((deck) => isDivideMatch(tile.value, deck.value, grid.target)),
  );
}

export type DivideMatchResult =
  | { readonly ok: true; readonly grid: DivideGrid }
  | { readonly ok: false; readonly reason: 'missing' | 'sameKind' | 'noMatch' };

/** Pair two tiles, in either order. A count with a deck that makes the target clears both. */
export function matchTiles(grid: DivideGrid, a: number, b: number): DivideMatchResult {
  const first = tileById(grid, a);
  const second = tileById(grid, b);
  if (!first || !second || a === b) {
    return { ok: false, reason: 'missing' };
  }
  if (first.kind === second.kind) {
    return { ok: false, reason: 'sameKind' };
  }
  const count = first.kind === 'count' ? first : second;
  const deck = first.kind === 'deck' ? first : second;
  if (!isDivideMatch(count.value, deck.value, grid.target)) {
    return { ok: false, reason: 'noMatch' };
  }
  const cells = grid.cells.map((cell) => (cell && (cell.id === a || cell.id === b) ? null : cell));
  return { ok: true, grid: { ...grid, cells } };
}

/** "+6", "−4". */
export function formatCountTile(count: number): string {
  return count > 0 ? `+${count}` : count < 0 ? `−${Math.abs(count)}` : '0';
}

/** "2", "1½", "½" — the deck tile's number (the word "deck(s)" sits under it). */
export function formatDeckTile(decks: number): string {
  const whole = Math.floor(decks);
  const half = decks - whole >= 0.5;
  return `${whole > 0 ? whole : ''}${half ? '½' : ''}`;
}
