import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomOut,
} from 'react-native-reanimated';
import {
  divideCellAt,
  DivideGrid,
  DivideTile,
  formatCountTile,
  formatDeckTile,
} from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fonts } from '../../theme';

/** Space between tiles on the board. */
export const DIVIDE_TILE_GAP = 8;
/** Tiles never grow past this, however much room there is. */
const MAX_TILE_WIDTH = 76;
/** Tiles are a little taller than wide. */
const TILE_ASPECT = 0.82;

/** The tile width that fits `grid` into a `width` × `height` box. */
export function divideTileWidth(grid: Pick<DivideGrid, 'rows' | 'cols'>, width: number, height: number): number {
  const byWidth = (width - DIVIDE_TILE_GAP * (grid.cols - 1)) / grid.cols;
  const byHeight = ((height - DIVIDE_TILE_GAP * (grid.rows - 1)) / grid.rows) * TILE_ASPECT;
  return Math.max(30, Math.floor(Math.min(MAX_TILE_WIDTH, byWidth, byHeight)));
}

interface DivideMatchBoardProps {
  readonly grid: DivideGrid;
  /** Bumps with every new grid. */
  readonly serial: number;
  readonly tileWidth: number;
  readonly selected: number | null;
  /** The last miss: its tiles shake. */
  readonly miss: { readonly ids: readonly number[]; readonly serial: number } | null;
  readonly disabled: boolean;
  readonly onDrop: (from: number, to: number) => void;
  readonly onTap: (id: number) => void;
}

interface BoardTileProps {
  readonly tile: DivideTile;
  readonly row: number;
  readonly col: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly selected: boolean;
  readonly missSerial: number | null;
  readonly disabled: boolean;
  readonly onRelease: (id: number, row: number, col: number, dx: number, dy: number) => void;
  readonly onTap: (id: number) => void;
}

function BoardTile({
  tile,
  row,
  col,
  tileWidth,
  tileHeight,
  selected,
  missSerial,
  disabled,
  onRelease,
  onTap,
}: BoardTileProps) {
  const reducedMotion = useReducedMotion();
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);
  const shake = useSharedValue(0);

  // A miss on this tile: a quick shake.
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

  const id = tile.id;
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

  // The tile in hand rides over its neighbours.
  const raised = useAnimatedStyle(() => ({ zIndex: lifted.value > 0 ? 10 : 1 }));
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value + shake.value },
      { translateY: dy.value },
      { scale: 1 + lifted.value * 0.08 },
    ],
  }));

  const isCount = tile.kind === 'count';
  const label = isCount
    ? `Running count ${formatCountTile(tile.value)}`
    : `${formatDeckTile(tile.value)} ${tile.value <= 1 ? 'deck' : 'decks'} left`;

  return (
    <Animated.View
      exiting={reducedMotion ? undefined : ZoomOut.duration(180)}
      style={[
        styles.slot,
        {
          left: col * (tileWidth + DIVIDE_TILE_GAP),
          top: row * (tileHeight + DIVIDE_TILE_GAP),
          width: tileWidth,
          height: tileHeight,
        },
        raised,
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.tile,
            isCount ? styles.countTile : styles.deckTile,
            { width: tileWidth, height: tileHeight },
            selected && styles.selected,
            style,
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected }}
        >
          {isCount ? (
            <Text style={[styles.countText, { fontSize: Math.round(tileWidth * 0.42) }]}>
              {formatCountTile(tile.value)}
            </Text>
          ) : (
            <View style={styles.deckInner}>
              <Text style={[styles.deckText, { fontSize: Math.round(tileWidth * 0.36) }]}>
                {formatDeckTile(tile.value)}
              </Text>
              <Text style={styles.deckWord}>{tile.value <= 1 ? 'DECK' : 'DECKS'}</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/**
 * The Divide and Match board: count tiles (cream) and deck tiles (blue) where
 * the grid puts them. Drag one onto a partner, or tap one then the other;
 * matched pairs zoom away.
 */
export function DivideMatchBoard({
  grid,
  serial,
  tileWidth,
  selected,
  miss,
  disabled,
  onDrop,
  onTap,
}: DivideMatchBoardProps) {
  const tileHeight = Math.round(tileWidth / TILE_ASPECT);
  const width = grid.cols * tileWidth + (grid.cols - 1) * DIVIDE_TILE_GAP;
  const height = grid.rows * tileHeight + (grid.rows - 1) * DIVIDE_TILE_GAP;

  /** Where a drag let go: the tile under the finger, if any, is the partner. */
  function release(id: number, row: number, col: number, moveX: number, moveY: number) {
    const targetRow = row + Math.round(moveY / (tileHeight + DIVIDE_TILE_GAP));
    const targetCol = col + Math.round(moveX / (tileWidth + DIVIDE_TILE_GAP));
    if (targetRow === row && targetCol === col) {
      return;
    }
    const target = divideCellAt(grid, targetRow, targetCol);
    if (target) {
      onDrop(id, target.id);
    }
  }

  return (
    <Animated.View key={serial} entering={FadeIn.duration(220)} style={{ width, height }}>
      {grid.cells.map((tile, index) =>
        tile ? (
          <BoardTile
            key={tile.id}
            tile={tile}
            row={Math.floor(index / grid.cols)}
            col={index % grid.cols}
            tileWidth={tileWidth}
            tileHeight={tileHeight}
            selected={selected === tile.id}
            missSerial={miss && miss.ids.includes(tile.id) ? miss.serial : null}
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
  tile: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
  },
  countTile: {
    backgroundColor: colors.arcadeCream,
  },
  deckTile: {
    backgroundColor: '#2E5C8A',
  },
  selected: {
    borderColor: colors.arcadeGold,
    borderWidth: 3,
  },
  countText: {
    fontFamily: fonts.display,
    color: colors.arcadeInk,
    includeFontPadding: false,
  },
  deckInner: {
    alignItems: 'center',
  },
  deckText: {
    fontFamily: fonts.display,
    color: colors.arcadeCream,
    includeFontPadding: false,
  },
  deckWord: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.arcadeCream,
  },
});
