import {
  chipRushBet,
  FLIP_MAX,
  FLIP_MIN,
  isDivideMatch,
  isMiniGame,
  remainingTiles,
  trainingLevelSpec,
} from '../../engine/dojo';
import { useBusyTableStore } from '../../stores/busyTableStore';
import { frontCard, useChipRushStore } from '../../stores/chipRushStore';
import { useDivideMatchStore } from '../../stores/divideMatchStore';
import { useFlipPointStore } from '../../stores/flipPointStore';
import { useSwipeStrategyStore } from '../../stores/swipeStrategyStore';

/** Plays a level's mini-game to the end, answering everything right. Returns the stars won. */
export function playMiniGamePerfectly(mapId: number, level: number): number {
  const spec = trainingLevelSpec(mapId, level);
  if (!isMiniGame(spec)) {
    throw new Error(`${mapId}:${level} is not a mini-game`);
  }
  switch (spec.mode) {
    case 'swipeStrategy': {
      const game = useSwipeStrategyStore.getState;
      game().load(mapId, level);
      game().begin();
      let guard = 0;
      while (game().status !== 'levelComplete' && game().status !== 'failed' && guard++ < 2000) {
        const state = game();
        if (state.status === 'cleared') {
          state.keepGoing();
        } else if (state.status === 'playing') {
          state.answer(state.item!.correct);
        } else {
          jest.advanceTimersByTime(100);
        }
      }
      return game().stars;
    }
    case 'divideMatch': {
      const game = useDivideMatchStore.getState;
      game().load(mapId, level);
      game().begin();
      let guard = 0;
      while (game().status !== 'levelComplete' && game().status !== 'failed' && guard++ < 2000) {
        const state = game();
        if (state.status === 'cleared') {
          state.keepGoing();
        } else if (state.status === 'playing') {
          const grid = state.grid!;
          const left = remainingTiles(grid);
          const pair = left
            .filter((tile) => tile.kind === 'count')
            .flatMap((count) =>
              left
                .filter((tile) => tile.kind === 'deck' && isDivideMatch(count.value, tile.value, grid.target))
                .map((deck) => [count.id, deck.id] as const),
            )[0];
          state.drop(pair[0], pair[1]);
        } else {
          jest.advanceTimersByTime(100);
        }
      }
      return game().stars;
    }
    case 'chipRush': {
      const game = useChipRushStore.getState;
      game().load(mapId, level);
      game().begin();
      let guard = 0;
      while (game().status !== 'levelComplete' && game().status !== 'failed' && guard++ < 5000) {
        const state = game();
        const front = frontCard(state.cards);
        if (state.status === 'cleared') {
          state.keepGoing();
        } else if (state.status === 'playing' && front) {
          state.bet(chipRushBet(front.trueCount));
        } else {
          jest.advanceTimersByTime(100);
        }
      }
      return game().stars;
    }
    case 'flipPoint': {
      const game = useFlipPointStore.getState;
      game().load(mapId, level);
      game().begin();
      let guard = 0;
      while (game().status !== 'levelComplete' && game().status !== 'failed' && guard++ < 2000) {
        const state = game();
        if (state.status === 'cleared') {
          state.keepGoing();
        } else if (state.status === 'sweeping') {
          // Stop the slider on the index (a flip at the very end, just before it).
          const index = state.item!.play.index;
          const value = index >= FLIP_MAX ? index - 0.2 : index;
          const target = ((value - FLIP_MIN) / (FLIP_MAX - FLIP_MIN)) * spec.sweepMs;
          jest.advanceTimersByTime(Math.max(0, Math.round(target - (Date.now() - state.sweepStartedAt!))));
          game().stop();
        } else {
          jest.advanceTimersByTime(100);
        }
      }
      return game().stars;
    }
    case 'busyTable': {
      const game = useBusyTableStore.getState;
      game().load(mapId, level);
      game().begin();
      let guard = 0;
      while (game().status !== 'levelComplete' && game().status !== 'failed' && guard++ < 5000) {
        const state = game();
        if (state.status === 'cleared') {
          state.keepGoing();
        } else if (state.status === 'asking') {
          state.answer(state.deal!.count);
        } else {
          jest.advanceTimersByTime(100);
        }
      }
      return game().stars;
    }
    default:
      throw new Error(`no player for ${spec.mode}`);
  }
}
