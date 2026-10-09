import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomOut,
} from 'react-native-reanimated';
import { CancelGrid, cellAt, GridCell } from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors } from '../../theme';
import { CARD_ASPECT } from '../game/PlayingCard';
import { CardFace } from './CardFace';

/** Space between cards on the board. */
export const GRID_GAP = 6;
/** The board never deals bigger cards than this, however much room there is. */
const MAX_CARD_WIDTH = 74;

/** The card width that fits `grid` into a `width` × `height` box. */
export function gridCardWidth(grid: Pick<CancelGrid, 'rows' | 'cols'>, width: number, height: number): number {
  const byWidth = (width - GRID_GAP * (grid.cols - 1)) / grid.cols;
  const byHeight = ((height - GRID_GAP * (grid.rows - 1)) / grid.rows) * CARD_ASPECT;
  return Math.max(24, Math.floor(Math.min(MAX_CARD_WIDTH, byWidth, byHeight)));
}

interface CancelGridBoardProps {
  readonly grid: CancelGrid;
  /** Bumps with every new grid. */
  readonly serial: number;
  readonly cardWidth: number;
  readonly selected: number | null;
  /** The last miss: its cards shake. */
  readonly miss: { readonly ids: readonly number[]; readonly serial: number } | null;
  readonly disabled: boolean;
  readonly onDrop: (from: number, to: number) => void;
  readonly onTap: (id: number) => void;
}

interface BoardCardProps {
  readonly cell: GridCell;
  readonly row: number;
  readonly col: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly selected: boolean;
  readonly missSerial: number | null;
  readonly disabled: boolean;
  /** A drag released `dx`, `dy` from where this card sits. */
  readonly onRelease: (id: number, row: number, col: number, dx: number, dy: number) => void;
  readonly onTap: (id: number) => void;
}

function BoardCard({
  cell,
  row,
  col,
  cardWidth,
  cardHeight,
  selected,
  missSerial,
  disabled,
  onRelease,
  onTap,
}: BoardCardProps) {
  const reducedMotion = useReducedMotion();
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);
  const shake = useSharedValue(0);

  // A miss on this card: a quick shake.
  useEffect(() => {
    if (missSerial === null || reducedMotion) {
      return;
    }
    shake.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 70 }),
      withTiming(-4, { duration: 60 }),
      withTiming(0, { duration: 50 }),
    );
  }, [missSerial, reducedMotion, shake]);

  const id = cell.id;
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(6)
    .onBegin(() => {
      lifted.value = withTiming(1, { duration: 90 });
    })
    .onUpdate((event) => {
      dx.value = event.translationX;
      dy.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(onRelease)(id, row, col, event.translationX, event.translationY);
    })
    .onFinalize(() => {
      dx.value = withSpring(0, { damping: 18, stiffness: 260 });
      dy.value = withSpring(0, { damping: 18, stiffness: 260 });
      lifted.value = withTiming(0, { duration: 120 });
    });
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd(() => {
      runOnJS(onTap)(id);
    });
  const gesture = Gesture.Exclusive(pan, tap);

  // The card in hand rides over its neighbours.
  const raised = useAnimatedStyle(() => ({ zIndex: lifted.value > 0 ? 10 : 1 }));
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value + shake.value },
      { translateY: dy.value },
      { scale: 1 + lifted.value * 0.08 },
    ],
  }));

  return (
    <Animated.View
      layout={reducedMotion ? undefined : LinearTransition.duration(220)}
      exiting={reducedMotion ? undefined : ZoomOut.duration(180)}
      style={[
        styles.slot,
        {
          left: col * (cardWidth + GRID_GAP),
          top: row * (cardHeight + GRID_GAP),
          width: cardWidth,
          height: cardHeight,
        },
        raised,
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={style}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${cell.card.rank} of ${cell.card.suit}, ${cell.value > 0 ? 'plus one' : cell.value < 0 ? 'minus one' : 'zero'}`}
          accessibilityState={{ selected }}
        >
          <CardFace card={cell.card} width={cardWidth} style={selected ? styles.selected : undefined} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/**
 * The Cancel Out board: every card where the grid puts it. Drag a card onto
 * the one it should cancel with, or tap one then the other; tap a 7, 8 or 9
 * to clear it. Cards zoom away when they clear and slide when the board
 * regroups.
 */
export function CancelGridBoard({
  grid,
  serial,
  cardWidth,
  selected,
  miss,
  disabled,
  onDrop,
  onTap,
}: CancelGridBoardProps) {
  const cardHeight = Math.round(cardWidth / CARD_ASPECT);
  const width = grid.cols * cardWidth + (grid.cols - 1) * GRID_GAP;
  const height = grid.rows * cardHeight + (grid.rows - 1) * GRID_GAP;

  /** Where a drag let go: the card under the finger, if any, is the target. */
  function release(id: number, row: number, col: number, moveX: number, moveY: number) {
    const targetRow = row + Math.round(moveY / (cardHeight + GRID_GAP));
    const targetCol = col + Math.round(moveX / (cardWidth + GRID_GAP));
    if (targetRow === row && targetCol === col) {
      return;
    }
    const target = cellAt(grid, targetRow, targetCol);
    if (target) {
      onDrop(id, target.id);
    }
  }

  return (
    <Animated.View key={serial} entering={FadeIn.duration(220)} style={{ width, height }}>
      {grid.cells.map((cell, index) =>
        cell ? (
          <BoardCard
            key={cell.id}
            cell={cell}
            row={Math.floor(index / grid.cols)}
            col={index % grid.cols}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            selected={selected === cell.id}
            missSerial={miss && miss.ids.includes(cell.id) ? miss.serial : null}
            disabled={disabled}
            onRelease={release}
            onTap={onTap}
          />
        ) : null,
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
  },
  selected: {
    borderWidth: 3,
    borderColor: colors.arcadeGold,
  },
});
