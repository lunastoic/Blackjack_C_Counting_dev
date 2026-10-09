import { neighbours, remaining } from '../../engine/dojo';
import { useCancelGridStore } from '../../stores/cancelGridStore';

const grid = () => useCancelGridStore.getState();

/** One right move on the board: tap a zero, else drop a card on a partner in reach. */
export function makeRightMove(): void {
  const board = grid().grid;
  if (!board) {
    throw new Error('no grid on the felt');
  }
  const left = remaining(board);
  const zero = left.find((cell) => cell.value === 0);
  if (zero) {
    expect(grid().tap(zero.id)).toBe(true);
    return;
  }
  for (const cell of left) {
    const partner = neighbours(board, cell.id).find((other) => other.value === -cell.value && cell.value !== 0);
    if (partner) {
      expect(grid().drop(cell.id, partner.id)).toBe(true);
      return;
    }
  }
  throw new Error('no move on a board that is still in play');
}

/** Plays a Cancel Out level through all its grids without a miss (fake timers). */
export function playCancelGridPerfectly(mapId: number, level: number): void {
  grid().load(mapId, level);
  grid().begin();
  let guard = 0;
  while (grid().status !== 'levelComplete' && grid().status !== 'failed' && guard++ < 1000) {
    const state = grid();
    switch (state.status) {
      case 'cleared':
        state.keepGoing();
        break;
      case 'feedback':
        jest.advanceTimersByTime(700);
        break;
      case 'asking':
        expect(state.answer(state.leftover!)).toBe(true);
        break;
      case 'playing':
        makeRightMove();
        break;
      default:
        throw new Error(`grid stuck at ${state.status}`);
    }
  }
}
