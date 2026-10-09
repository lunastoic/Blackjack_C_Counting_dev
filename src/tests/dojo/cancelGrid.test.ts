import { makeCard } from '../../engine/cards/card';
import {
  CancelGrid,
  cancelPair,
  clearNeutral,
  flashLevelKey,
  GridCell,
  hasPairInReach,
  isSettled,
  makeCancelGrid,
  needsRegroup,
  neighbours,
  regroup,
  remaining,
  remainingCount,
  trainingLevelSpec,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import {
  __setCancelGridRngForTests,
  GRID_CLEAR_TOP_UP,
  useCancelGridStore,
} from '../../stores/cancelGridStore';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { meterFillAt } from '../../stores/trainingStore';
import { makeRightMove, playCancelGridPerfectly } from './cancelGridHelpers';

/** A hand-built board: values row by row, null for a gap. */
function board(rows: (number | null)[][]): CancelGrid {
  let id = 0;
  const cells: (GridCell | null)[] = rows.flat().map((value) => {
    if (value === null) {
      return null;
    }
    const rank = value > 0 ? '5' : value < 0 ? 'K' : '8';
    return { id: id++, card: makeCard(rank, 'spades'), value };
  });
  return { rows: rows.length, cols: rows[0].length, cells };
}

describe('cancel grid — the board', () => {
  it('deals the size asked, a quarter or so neutral, and at most the leftover asked', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const spec of [
        { rows: 5, cols: 4, maxLeftover: 0 },
        { rows: 5, cols: 4, maxLeftover: 2 },
        { rows: 6, cols: 5, maxLeftover: 3 },
      ]) {
        const grid = makeCancelGrid(spec, seededRng(seed));
        expect(grid.cells).toHaveLength(spec.rows * spec.cols);
        const left = remaining(grid);
        expect(left).toHaveLength(spec.rows * spec.cols);
        const zeros = left.filter((cell) => cell.value === 0).length;
        expect(zeros).toBeGreaterThanOrEqual(Math.round(spec.rows * spec.cols * 0.25));
        expect(zeros).toBeLessThanOrEqual(Math.round(spec.rows * spec.cols * 0.25) + 1);
        const sum = remainingCount(grid);
        expect(Math.abs(sum)).toBeLessThanOrEqual(spec.maxLeftover);
        if (spec.maxLeftover > 0) {
          expect(sum).not.toBe(0);
        }
        // Every card's value is its rank's Hi-Lo value.
        for (const cell of left) {
          expect([-1, 0, 1]).toContain(cell.value);
        }
      }
    }
  });

  it('finds the nearest card in each of the eight directions, skipping gaps', () => {
    const grid = board([
      [1, null, -1],
      [null, 0, null],
      [-1, null, 1],
    ]);
    const centre = neighbours(grid, 2).map((cell) => cell.id).sort();
    expect(centre).toEqual([0, 1, 3, 4].sort());
    // The top-left card sees across the gap to the right and down past the gap.
    expect(neighbours(grid, 0).map((cell) => cell.id).sort()).toEqual([1, 2, 3].sort());
  });

  it('cancels a +1 and a −1 in reach; anything else is a miss', () => {
    const grid = board([
      [1, -1, 1],
      [0, 0, 0],
      [0, 0, -1],
    ]);
    expect(cancelPair(grid, 0, 1)).toMatchObject({ ok: true });
    expect(cancelPair(grid, 0, 2)).toEqual({ ok: false, reason: 'noCancel' });
    // Two cards of opposite sign but not in reach: the zero row is between them.
    expect(cancelPair(grid, 0, 8)).toEqual({ ok: false, reason: 'notNeighbours' });
    expect(clearNeutral(grid, 3)).toMatchObject({ ok: true });
    expect(clearNeutral(grid, 0)).toEqual({ ok: false, reason: 'noCancel' });
  });

  it('regroups a stuck board into a block where a pair always touches', () => {
    const stuck = board([
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, -1],
    ]);
    // Not stuck: the diagonal reaches.
    expect(hasPairInReach(stuck)).toBe(true);
    const farApart = board([
      [1, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, -1],
    ]);
    expect(hasPairInReach(farApart)).toBe(false);
    expect(needsRegroup(farApart)).toBe(true);
    const packed = regroup(farApart);
    expect(hasPairInReach(packed)).toBe(true);
    expect(remaining(packed).map((cell) => cell.id)).toEqual(remaining(farApart).map((cell) => cell.id));
  });

  it('settles once only one sign is left — its sum is the call', () => {
    expect(isSettled(board([[1, 1, null]]))).toBe(true);
    expect(remainingCount(board([[1, 1, null]]))).toBe(2);
    expect(isSettled(board([[1, 0, null]]))).toBe(false);
    expect(isSettled(board([[1, -1, null]]))).toBe(false);
    expect(isSettled(board([[null, null]]))).toBe(true);
  });

  it('every dealt grid can always be played out, whatever order the moves come in', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = seededRng(seed * 13);
      let grid = makeCancelGrid({ rows: 6, cols: 5, maxLeftover: 3 }, seededRng(seed));
      let guard = 0;
      while (!isSettled(grid) && guard++ < 100) {
        const left = remaining(grid);
        const moves: (() => CancelGrid)[] = [];
        for (const cell of left) {
          if (cell.value === 0) {
            moves.push(() => (clearNeutral(grid, cell.id) as { grid: CancelGrid }).grid);
            continue;
          }
          for (const other of neighbours(grid, cell.id)) {
            if (other.value === -cell.value) {
              moves.push(() => (cancelPair(grid, cell.id, other.id) as { grid: CancelGrid }).grid);
            }
          }
        }
        expect(moves.length).toBeGreaterThan(0);
        grid = moves[Math.floor(random() * moves.length)]();
      }
      expect(isSettled(grid)).toBe(true);
      const left = remaining(grid);
      expect(new Set(left.map((cell) => Math.sign(cell.value))).size).toBeLessThanOrEqual(1);
    }
  });
});

describe('cancel grid — the level', () => {
  const store = () => useCancelGridStore.getState();

  beforeEach(() => {
    jest.useFakeTimers();
    __resetPersistenceForTests();
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate(defaults.dojo);
    useEconomyStore.getState().hydrate(defaults.economy);
    useProgressionStore.getState().hydrate(defaults.progression);
    useSettingsStore.getState().hydrate(defaults.settings);
    __setCancelGridRngForTests(seededRng(5));
    store().load(1, 2);
  });

  afterEach(() => {
    store().reset();
    __setCancelGridRngForTests();
    jest.useRealTimers();
  });

  it('is Luna Luxe level 2: three grids, three strikes, a star a grid', () => {
    expect(trainingLevelSpec(1, 2)).toMatchObject({ mode: 'cancelGrid', strikes: 3 });
    expect(store().spec?.grids).toHaveLength(3);
    expect(store().targets).toEqual([1, 2, 3]);
    expect(store().status).toBe('idle');
  });

  it('played through without a miss: a star a grid, a pause at the clear, three stars at the end', () => {
    playCancelGridPerfectly(1, 2);
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(store().gridsDone).toBe(3);
    expect(store().misses).toBe(0);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 2)]).toBe(3);
    expect(useDojoStore.getState().isFlashLevelUnlocked(1, 3)).toBe(true);
    expect(useDojoStore.getState().flashBests[flashLevelKey(1, 2)]?.run).toBe(3);
  });

  it('pauses at the clear (two grids) for Keep going or Stop', () => {
    store().begin();
    let guard = 0;
    while (store().status !== 'cleared' && guard++ < 400) {
      const state = store();
      if (state.status === 'asking') state.answer(state.leftover!);
      else if (state.status === 'feedback') jest.advanceTimersByTime(700);
      else makeRightMove();
    }
    expect(store().stars).toBe(2);
    expect(store().gridsDone).toBe(2);
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(useDojoStore.getState().flashLevels[flashLevelKey(1, 2)]).toBe(2);
  });

  it('the meter drains while the grid is up, a clear tops it up, and running dry ends the run', () => {
    store().begin();
    expect(store().status).toBe('playing');
    expect(store().meter.draining).toBe(true);
    jest.advanceTimersByTime(3000);
    const drainMs = store().meterDrainMs;
    const before = meterFillAt(store().meter, drainMs, Date.now());
    expect(before).toBeCloseTo(1 - 3000 / drainMs, 2);
    makeRightMove();
    const after = meterFillAt(store().meter, drainMs, Date.now());
    expect(after).toBeCloseTo(Math.min(1, before + GRID_CLEAR_TOP_UP), 2);
    jest.advanceTimersByTime(drainMs);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(true);
  });

  it('a drop that does not cancel costs a strike and shakes both cards; the fourth ends the run', () => {
    store().begin();
    const grid = store().grid!;
    const plus = remaining(grid).filter((cell) => cell.value === 1);
    expect(plus.length).toBeGreaterThanOrEqual(2);
    for (let miss = 1; miss <= 3; miss++) {
      expect(store().drop(plus[0].id, plus[1].id)).toBe(false);
      expect(store().misses).toBe(miss);
      expect(store().lastMiss?.ids).toEqual([plus[0].id, plus[1].id]);
      expect(store().status).toBe('playing');
    }
    expect(store().drop(plus[0].id, plus[1].id)).toBe(false);
    expect(store().status).toBe('failed');
    expect(store().timedOut).toBe(false);
  });

  it('tap a +1, then its −1 in reach: they cancel; tapping a +1 alone just picks it', () => {
    store().begin();
    const grid = store().grid!;
    const pair = remaining(grid)
      .filter((cell) => cell.value === 1)
      .map((cell) => [cell, neighbours(grid, cell.id).find((other) => other.value === -1)] as const)
      .find(([, partner]) => partner !== undefined);
    if (!pair) {
      return; // This deal opened with no pair in reach; other tests cover the drop.
    }
    const [plus, minus] = pair;
    expect(store().tap(plus.id)).toBe(true);
    expect(store().selected).toBe(plus.id);
    expect(store().tap(minus!.id)).toBe(true);
    expect(store().selected).toBeNull();
    expect(store().grid!.cells.some((cell) => cell?.id === plus.id)).toBe(false);
    expect(store().misses).toBe(0);
  });

  it('a wrong call at the end of a grid costs a strike and asks again', () => {
    // Grid 1 always clears to nothing; play it, then the second leaves cards to call.
    store().begin();
    let guard = 0;
    while (store().status !== 'asking' && guard++ < 400) {
      if (store().status === 'feedback') jest.advanceTimersByTime(700);
      else makeRightMove();
    }
    expect(store().gridIndex).toBe(1);
    const leftover = store().leftover!;
    expect(leftover).not.toBe(0);
    expect(store().answer(leftover + 1)).toBe(false);
    expect(store().misses).toBe(1);
    expect(store().status).toBe('feedback');
    jest.advanceTimersByTime(1500);
    expect(store().status).toBe('asking');
    expect(store().answer(leftover)).toBe(true);
    expect(store().gridsDone).toBe(2);
  });
});
