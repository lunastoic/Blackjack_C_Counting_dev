import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CHIP_SETS } from '../../assets/registry';
import { CasinoMap } from '../../engine/betting/casino';
import {
  FlashProgress,
  flashStars,
  isFlashLevelDone,
  isFlashLevelUnlocked,
  nextFlashLevel,
  trainingLevelsForMap,
} from '../../engine/dojo';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { PressableScale } from '../common/PressableScale';

/**
 * Horizontal centre of each node as a fraction of the path width. The trail
 * wanders: long sweeps out to the card's edges, short hops back in.
 */
const NODE_X: readonly number[] = [0.18, 0.82, 0.58, 0.2, 0.78, 0.42];
const MAX_NODE = 68;
const MIN_NODE = 44;
const DASH = 10;
const DASH_GAP = 7;
const DASH_HEIGHT = 3;
/**
 * Bend of each run between chips, in order down the ladder: 1 drops out of a
 * chip and arches round into the next, 0 is a straight diagonal. Mixed so the
 * trail reads like a road, not a pattern.
 */
const SEGMENT_BEND: readonly number[] = [1, 0, 1, 0, 1];
/** Straight-line samples used to walk the curve's arc length. */
const CURVE_SAMPLES = 48;
/** Titles get up to a bit over half the path, less when the chip sits inboard. */
const LABEL_WIDTH_RATIO = 0.55;
const FLAG_WIDTH = 64;
const FLAG_ROOM = 22;

export type LevelNodeState = 'done' | 'current' | 'locked';

interface LevelPathProps {
  readonly map: CasinoMap;
  readonly progress: FlashProgress;
  readonly width: number;
  /** All six nodes are laid out to fit exactly this height — never scrolls. */
  readonly height: number;
  readonly onSelect: (level: number) => void;
  /** False while the casino itself is locked: every node reads locked, no START flag. */
  readonly interactive?: boolean;
  /** DEV: every level is tappable regardless of progress. */
  readonly unlockAll?: boolean;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Chip art climbs the denominations as the ladder climbs. */
function chipForLevel(map: CasinoMap, level: number): number {
  const set = CHIP_SETS[map.chipSetKey] ?? CHIP_SETS.default;
  const denominations = Object.keys(set)
    .map(Number)
    .sort((a, b) => a - b);
  const denomination = denominations[Math.min(level - 1, denominations.length - 1)];
  return set[denomination];
}

function nodeState(progress: FlashProgress, mapId: number, level: number): LevelNodeState {
  if (isFlashLevelDone(progress, mapId, level)) {
    return 'done';
  }
  return isFlashLevelUnlocked(progress, mapId, level) ? 'current' : 'locked';
}

/**
 * The winding six-node ladder for one casino, scaled to the space it is
 * given: chip nodes joined by a dashed gold trail, titles beside each chip,
 * a START flag on the level in play, locks on everything ahead.
 */
export function LevelPath({
  map,
  progress,
  width,
  height,
  onSelect,
  interactive = true,
  unlockAll = false,
}: LevelPathProps) {
  const levels = trainingLevelsForMap(map.id);
  const count = levels.length;
  const usable = Math.max(1, height - FLAG_ROOM * 2);
  const nodeSize = Math.round(Math.min(MAX_NODE, Math.max(MIN_NODE, (usable / count) * 0.72)));
  const step = (usable - nodeSize) / (count - 1);
  const centers: Point[] = levels.map((_, index) => ({
    x: NODE_X[index % NODE_X.length] * width,
    y: FLAG_ROOM + nodeSize / 2 + index * step,
  }));
  const nextLevel = interactive ? nextFlashLevel(progress, map.id) : null;
  const labelInset = nodeSize / 2 + spacing.sm;

  /** The label runs from the chip toward the card centre and never past the edge. */
  function labelFor(center: Point): { side: 'left' | 'right'; width: number } {
    const side = center.x < width / 2 ? 'right' : 'left';
    const room = side === 'right' ? width - center.x - labelInset : center.x - labelInset;
    return { side, width: Math.min(Math.round(width * LABEL_WIDTH_RATIO), Math.floor(room)) };
  }

  return (
    <View style={{ width, height }}>
      {centers.slice(1).map((to, index) => (
        <TrailSegment
          key={index}
          from={centers[index]}
          to={to}
          bend={SEGMENT_BEND[index % SEGMENT_BEND.length]}
          nodeSize={nodeSize}
        />
      ))}
      {levels.map((spec, index) => (
        <LevelNode
          key={spec.level}
          level={spec.level}
          title={spec.title}
          state={
            !interactive
              ? 'locked'
              : unlockAll && !isFlashLevelDone(progress, map.id, spec.level)
                ? 'current'
                : nodeState(progress, map.id, spec.level)
          }
          isStart={spec.level === nextLevel}
          stars={flashStars(progress, map.id, spec.level)}
          chip={chipForLevel(map, spec.level)}
          center={centers[index]}
          nodeSize={nodeSize}
          labelWidth={labelFor(centers[index]).width}
          labelSide={labelFor(centers[index]).side}
          onPress={() => onSelect(spec.level)}
        />
      ))}
    </View>
  );
}

interface LevelNodeProps {
  readonly level: number;
  readonly title: string;
  readonly state: LevelNodeState;
  readonly isStart: boolean;
  readonly stars: number;
  readonly chip: number;
  readonly center: Point;
  readonly nodeSize: number;
  readonly labelWidth: number;
  readonly labelSide: 'left' | 'right';
  readonly onPress: () => void;
}

function LevelNode({
  level,
  title,
  state,
  isStart,
  stars,
  chip,
  center,
  nodeSize,
  labelWidth,
  labelSide,
  onPress,
}: LevelNodeProps) {
  const locked = state === 'locked';
  const badge = Math.round(nodeSize * 0.4);
  return (
    <View
      style={[
        styles.node,
        { left: center.x - nodeSize / 2, top: center.y - nodeSize / 2, width: nodeSize },
      ]}
    >
      {isStart ? (
        <View
          style={[
            styles.startFlag,
            { top: -FLAG_ROOM, width: FLAG_WIDTH, left: (nodeSize - FLAG_WIDTH) / 2 },
          ]}
        >
          <Text style={styles.startText} numberOfLines={1}>
            START
          </Text>
        </View>
      ) : null}
      <PressableScale
        accessibilityLabel={`Level ${level}: ${title}${locked ? ', locked' : ''}`}
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPress={onPress}
        style={[
          styles.chipWrap,
          { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 },
          state === 'current' && styles.chipWrapCurrent,
        ]}
      >
        {locked ? (
          <View
            style={[
              styles.lockedDisc,
              { width: nodeSize * 0.86, height: nodeSize * 0.86, borderRadius: nodeSize },
            ]}
          />
        ) : null}
        <Image
          source={chip}
          style={[{ width: nodeSize, height: nodeSize }, locked && styles.chipLocked]}
          resizeMode="contain"
        />
        {locked ? (
          <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
            <Ionicons name="lock-closed" size={Math.round(badge * 0.55)} color={colors.textPrimary} />
          </View>
        ) : null}
        {state === 'done' ? (
          <View
            style={[
              styles.badge,
              styles.badgeDone,
              { width: badge, height: badge, borderRadius: badge / 2 },
            ]}
          >
            <Ionicons name="checkmark" size={Math.round(badge * 0.6)} color={colors.textOnGold} />
          </View>
        ) : null}
      </PressableScale>

      {/* Title + stars sit beside the chip (toward the card centre) so nothing stacks vertically. */}
      <View
        pointerEvents="none"
        style={[
          styles.label,
          { top: nodeSize / 2 - 18, width: labelWidth },
          labelSide === 'right'
            ? { left: nodeSize + spacing.sm, alignItems: 'flex-start' }
            : { right: nodeSize + spacing.sm, alignItems: 'flex-end' },
        ]}
      >
        <Text
          style={[
            styles.title,
            locked && styles.titleLocked,
            labelSide === 'left' && styles.titleRightAligned,
          ]}
          numberOfLines={2}
        >
          {level}. {title}
        </Text>
        <View style={styles.stars} accessibilityLabel={`${stars} of 3 stars`}>
          {[0, 1, 2].map((index) => (
            <Ionicons
              key={index}
              name={index < stars ? 'star' : 'star-outline'}
              size={13}
              color={index < stars ? colors.goldBright : colors.textMuted}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Point on the run from `from` to `to`: straight at bend 0, a full S at bend 1. */
function curvePoint(from: Point, to: Point, bendRatio: number, t: number): Point {
  const bend = (to.y - from.y) * bendRatio;
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * from.x + b * from.x + c * to.x + d * to.x,
    y: a * from.y + b * (from.y + bend) + c * (to.y - bend) + d * to.y,
  };
}

interface Dash {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Dashes spaced evenly along the run's arc, trimmed clear of both chips. */
function dashesAlong(from: Point, to: Point, bend: number, nodeSize: number): Dash[] {
  const points = Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) =>
    curvePoint(from, to, bend, index / CURVE_SAMPLES),
  );
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    lengths.push(lengths[index - 1] + Math.hypot(next.x - prev.x, next.y - prev.y));
  }
  const total = lengths[lengths.length - 1];
  const trim = nodeSize / 2 + 6;
  const inner = Math.max(0, total - trim * 2);
  const count = Math.max(0, Math.floor((inner + DASH_GAP) / (DASH + DASH_GAP)));
  const used = count * DASH + Math.max(0, count - 1) * DASH_GAP;
  const start = trim + (inner - used) / 2 + DASH / 2;

  const dashes: Dash[] = [];
  let cursor = 1;
  for (let index = 0; index < count; index += 1) {
    const distance = start + index * (DASH + DASH_GAP);
    while (cursor < lengths.length - 1 && lengths[cursor] < distance) {
      cursor += 1;
    }
    const prev = points[cursor - 1];
    const next = points[cursor];
    const span = lengths[cursor] - lengths[cursor - 1];
    const t = span > 0 ? (distance - lengths[cursor - 1]) / span : 0;
    dashes.push({
      x: prev.x + (next.x - prev.x) * t,
      y: prev.y + (next.y - prev.y) * t,
      angle: Math.atan2(next.y - prev.y, next.x - prev.x),
    });
  }
  return dashes;
}

interface TrailSegmentProps {
  readonly from: Point;
  readonly to: Point;
  readonly bend: number;
  readonly nodeSize: number;
}

/** Run of gold dashes from one chip to the next — straight or winding. */
function TrailSegment({ from, to, bend, nodeSize }: TrailSegmentProps) {
  const dashes = useMemo(() => dashesAlong(from, to, bend, nodeSize), [from, to, bend, nodeSize]);
  return (
    <>
      {dashes.map((dash, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.dash,
            {
              left: dash.x - DASH / 2,
              top: dash.y - DASH_HEIGHT / 2,
              transform: [{ rotate: `${dash.angle}rad` }],
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    alignItems: 'center',
  },
  startFlag: {
    position: 'absolute',
    zIndex: 2,
    alignItems: 'center',
    backgroundColor: colors.textPrimary,
    borderRadius: radii.pill,
    paddingVertical: 2,
    ...shadows.raised,
  },
  startText: {
    color: colors.textOnGold,
    fontSize: 10,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.2,
  },
  chipWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrapCurrent: {
    shadowColor: colors.goldBright,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  chipLocked: {
    opacity: 0.35,
  },
  lockedDisc: {
    position: 'absolute',
    backgroundColor: colors.disabled,
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.disabled,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeDone: {
    backgroundColor: colors.goldBright,
  },
  label: {
    position: 'absolute',
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    lineHeight: 17,
  },
  titleRightAligned: {
    textAlign: 'right',
  },
  titleLocked: {
    color: colors.textSecondary,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  dash: {
    position: 'absolute',
    width: DASH,
    height: DASH_HEIGHT,
    borderRadius: 2,
    backgroundColor: colors.goldDim,
  },
});
