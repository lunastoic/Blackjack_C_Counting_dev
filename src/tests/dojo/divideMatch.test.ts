import {
  DivideGrid,
  deckValues,
  DIVIDE_TARGETS,
  divideCellAt,
  flashLevelKey,
  formatCountTile,
  formatDeckTile,
  hasDivideMatch,
  isDivideMatch,
  isGridClear,
  makeDivideGrid,
  matchTiles,
  remainingTiles,
  trainingLevelSpec,
  uniqueCounts,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import {
  __setDivideMatchRngForTests,
  DIVIDE_MATCH_TOP_UP,
  useDivideMatchStore,
} from '../../stores/divideMatchStore';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { meterFillAt } from '../../stores/trainingStore';

const SPEC = { rows: 4, cols: 5, maxDecks: 4, halfDecks: true };

/** Every valid pair on the board, as [count id, deck id]. */
function validPairs(grid: DivideGrid): [number, number][] {
  const left = remainingTiles(grid);
  const pairs: [number, number][] = [];
  for (const count of left.filter((tile) => tile.kind === 'count')) {
    for (const deck of left.filter((tile) => tile.kind === 'deck')) {
      if (isDivideMatch(count.value, deck.value, grid.target)) {
        pairs.push([count.id, deck.id]);
      }
    }
  }
  return pairs;
}

describe('divide and match — the board', () => {
  it('a match is the count ÷ the decks, rounded down, equal to the target', () => {
    expect(isDivideMatch(8, 2, 4)).toBe(true);
    expect(isDivideMatch(9, 2, 4)).toBe(true);
    expect(isDivideMatch(10, 2, 4)).toBe(false);
    expect(isDivideMatch(5, 1.5, 3)).toBe(true);
    expect(isDivideMatch(3, 0.5, 6)).toBe(true);
  });

  it('lists the deck values the level allows', () => {
    expect(deckValues(4, true)).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
    expect(deckValues(2, false)).toEqual([1, 2]);
  });

  it('only offers counts that work with exactly one deck value on the board', () => {
    const present = [1, 2, 3];
    for (const target of DIVIDE_TARGETS) {
      for (const decks of present) {
        for (const count of uniqueCounts(target, decks, present)) {
          const matches = present.filter((other) => isDivideMatch(count, other, target));
          expect(matches).toEqual([decks]);
        }
      }
    }
  });

  it('deals half count tiles and half deck tiles, a target from +1 to +4, every tile pairable', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const grid = makeDivideGrid(SPEC, seededRng(seed));
      const left = remainingTiles(grid);
      expect(left).toHaveLength(20);
      expect(left.filter((tile) => tile.kind === 'count')).toHaveLength(10);
      expect(DIVIDE_TARGETS).toContain(grid.target);
      for (const tile of left) {
        if (tile.kind === 'deck') {
          expect(tile.value).toBeGreaterThanOrEqual(0.5);
          expect(tile.value).toBeLessThanOrEqual(4);
        }
      }
      for (const count of left.filter((tile) => tile.kind === 'count')) {
        const partners = new Set(
          left
            .filter((tile) => tile.kind === 'deck' && isDivideMatch(count.value, tile.value, grid.target))
            .map((tile) => tile.value),
        );
        expect(partners.size).toBe(1);
      }
    }
  });

  it('every grid can be cleared, whatever valid pairs are made in whatever order', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = seededRng(seed * 31);
      let grid = makeDivideGrid(SPEC, seededRng(seed));
      let guard = 0;
      while (!isGridClear(grid) && guard++ < 40) {
        const pairs = validPairs(grid);
        expect(pairs.length).toBeGreaterThan(0);
        expect(hasDivideMatch(grid)).toBe(true);
        const [a, b] = pairs[Math.floor(random() * pairs.length)];
        // Either tile may be the one dragged.
        const result = random() < 0.5 ? matchTiles(grid, a, b) : matchTiles(grid, b, a);
        if (!result.ok) {
          throw new Error(`valid pair refused: ${result.reason}`);
        }
        grid = result.grid;
      }
      expect(isGridClear(grid)).toBe(true);
    }
  });

  it('refuses two counts, two decks, and pairs that miss the target', () => {
    const grid: DivideGrid = {
      rows: 1,
      cols: 4,
      target: 2,
      cells: [
        { id: 0, kind: 'count', value: 4 },
        { id: 1, kind: 'deck', value: 2 },
        { id: 2, kind: 'count', value: 9 },
        { id: 3, kind: 'deck', value: 1 },
      ],
    };
    expect(matchTiles(grid, 0, 2)).toEqual({ ok: false, reason: 'sameKind' });
    expect(matchTiles(grid, 1, 3)).toEqual({ ok: false, reason: 'sameKind' });
    expect(matchTiles(grid, 2, 1)).toEqual({ ok: false, reason: 'noMatch' });
    expect(matchTiles(grid, 0, 0)).toEqual({ ok: false, reason: 'missing' });
    const ok = matchTiles(grid, 1, 0);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(divideCellAt(ok.grid, 0, 0)).toBeNull();
      expect(divideCellAt(ok.grid, 0, 1)).toBeNull();
      expect(remainingTiles(ok.grid)).toHaveLength(2);
    }
  });

  it('formats tiles the way they read', () => {
    expect(formatCountTile(6)).toBe('+6');
    expect(formatCountTile(-4)).toBe('−4');
    expect(formatDeckTile(2)).toBe('2');
    expect(formatDeckTile(1.5)).toBe('1½');
    expect(formatDeckTile(0.5)).toBe('½');
  });
});

describe('divide and match — the level', () => {
  const store = () => useDivideMatchStore.getState();

  /** One right move: the first valid pair on the board. */
  function matchOne(): void {
    const pairs = validPairs(store().grid!);
    expect(pairs.length).toBeGreaterThan(0);
    expect(store().drop(pairs[0][0], pairs[0][1])).toBe(true);
  }

  /** Plays until `status` lands, matching pairs and waiting out the beats between grids. */
  function playUntil(status: string): void {
    let guard = 0;
    while (store().status !== status && guard++ < 400) {
      if (store().status === 'feedback') {
        jest.advanceTimersByTime(700);
      } else if (store().status === 'cleared') {
        store().keepGoing();
      } else if (store().status === 'playing') {
        matchOne();
      } else {
        break;
      }
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    __resetPersistenceForTests();
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate(defaults.dojo);
    useEconomyStore.getState().hydrate(defaults.economy);
    useProgressionStore.getState().hydrate(defaults.progression);
    useSettingsStore.getState().hydrate(defaults.settings);
    __setDivideMatchRngForTests(seededRng(9));
    store().load(3, 2);
  });

  afterEach(() => {
    store().reset();
    __setDivideMatchRngForTests();
    jest.useRealTimers();
  });

  it('is Europa Ice level 2: three grids, a star a grid', () => {
    expect(trainingLevelSpec(3, 2)).toMatchObject({ mode: 'divideMatch', maxDecks: 4, halfDecks: true });
    expect(store().spec?.grids).toHaveLength(3);
    expect(store().targets).toEqual([1, 2, 3]);
    expect(store().status).toBe('idle');
  });

  it('played through without a miss: a star a grid, a pause at the clear, three stars at the end', () => {
    store().begin();
    playUntil('cleared');
    expect(store().stars).toBe(2);
    expect(store().gridsDone).toBe(2);
    expect(useDojoStore.getState().isFlashLevelUnlocked(3, 3)).toBe(true);
    store().keepGoing();
    playUntil('levelComplete');
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(store().misses).toBe(0);
    expect(store().matches).toBe(30);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(3, 2)]).toBe(3);
    expect(useDojoStore.getState().flashBests[flashLevelKey(3, 2)]?.run).toBe(3);
  });

  it('Stop at the clear banks two stars and ends the run', () => {
    store().begin();
    playUntil('cleared');
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(useDojoStore.getState().flashLevels[flashLevelKey(3, 2)]).toBe(2);
  });

  it('the meter drains while the grid is up, a match tops it up, and running dry ends the run', () => {
    store().begin();
    expect(store().status).toBe('playing');
    expect(store().meter.draining).toBe(true);
    jest.advanceTimersByTime(3000);
    const drainMs = store().meterDrainMs;
    const before = meterFillAt(store().meter, drainMs, Date.now());
    expect(before).toBeCloseTo(1 - 3000 / drainMs, 2);
    matchOne();
    const after = meterFillAt(store().meter, drainMs, Date.now());
    expect(after).toBeCloseTo(Math.min(1, before + DIVIDE_MATCH_TOP_UP), 2);
    jest.advanceTimersByTime(drainMs);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(true);
  });

  it('a pair that misses costs a strike and shakes both tiles; one past the strikes ends the run', () => {
    store().begin();
    const grid = store().grid!;
    const counts = remainingTiles(grid).filter((tile) => tile.kind === 'count');
    const decks = remainingTiles(grid).filter((tile) => tile.kind === 'deck');
    const wrong = counts
      .flatMap((count) => decks.map((deck) => [count, deck] as const))
      .find(([count, deck]) => !isDivideMatch(count.value, deck.value, grid.target));
    expect(wrong).toBeDefined();
    const [count, deck] = wrong!;
    const strikes = store().spec!.strikes;
    for (let miss = 1; miss <= strikes; miss++) {
      expect(store().drop(count.id, deck.id)).toBe(false);
      expect(store().misses).toBe(miss);
      expect(store().lastMiss?.ids).toEqual([count.id, deck.id]);
      expect(store().status).toBe('playing');
    }
    expect(store().drop(count.id, deck.id)).toBe(false);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(false);
  });

  it('two tiles of the same kind is a strike too', () => {
    store().begin();
    const counts = remainingTiles(store().grid!).filter((tile) => tile.kind === 'count');
    expect(store().drop(counts[0].id, counts[1].id)).toBe(false);
    expect(store().misses).toBe(1);
  });

  it('tap a tile, then its partner: they match; tapping one alone just picks it', () => {
    store().begin();
    const [a, b] = validPairs(store().grid!)[0];
    expect(store().tap(a)).toBe(true);
    expect(store().selected).toBe(a);
    expect(store().tap(a)).toBe(true);
    expect(store().selected).toBeNull();
    store().tap(a);
    expect(store().tap(b)).toBe(true);
    expect(store().selected).toBeNull();
    expect(remainingTiles(store().grid!).some((tile) => tile.id === a || tile.id === b)).toBe(false);
    expect(store().misses).toBe(0);
  });

  it('a run of matches leaves no timers behind once it ends', () => {
    store().begin();
    playUntil('cleared');
    store().stopRun();
    expect(jest.getTimerCount()).toBe(0);
  });
});
