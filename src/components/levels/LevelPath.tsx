import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CHIP_SETS, LEVEL_ART } from '../../assets/registry';
import { CasinoMap } from '../../engine/betting/casino';
import {
  FlashProgress,
  flashLevelKey,
  flashStars,
  isFlashLevelDone,
  isFlashLevelUnlocked,
  nextFlashLevel,
  trainingLevelsForMap,
} from '../../engine/dojo';
import { colors, fonts, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { ArcadeBadge, ArcadeFlag, arcadeShadow } from '../arcade';
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
/** Level art carries clear margins a chip does not, so it draws past the node's box. */
const LEVEL_ART_SCALE = 1.25;

/**
 * Modern: where each node sits, as fractions of the ladder area, and the side
 * its title takes — traced from the approved mock (a 323×519 ladder). The
 * trail winds through the centres in order.
 */
const MODERN_NODES: readonly { x: number; y: number; side: 'left' | 'right' }[] = [
  { x: 0.285, y: 0.096, side: 'right' },
  { x: 0.839, y: 0.227, side: 'left' },
  { x: 0.61, y: 0.405, side: 'left' },
  { x: 0.297, y: 0.543, side: 'right' },
  { x: 0.796, y: 0.688, side: 'left' },
  { x: 0.514, y: 0.842, side: 'right' },
];
const MODERN_MOCK_WIDTH = 323;
const MODERN_MOCK_HEIGHT = 519;
const MODERN_NODE = 72;
const MODERN_MIN_NODE = 48;
const MODERN_LABEL_MAX = 150;
const MODERN_LABEL_GAP = 6;
/** The START flag sits this far above the node's box. */
const MODERN_FLAG_LIFT = 16;
const MODERN_DASH = 9;
const MODERN_DASH_GAP = 7;
const MODERN_DASH_HEIGHT = 2.5;
/** Every Modern run bends the same gentle S; the trail runs under the nodes. */
const MODERN_BEND = 0.5;

export type LevelNodeState = 'done' | 'current' | 'locked';

interface LevelPathProps {
  readonly map: CasinoMap;
  readonly progress: FlashProgress;
  /** Best pace per level (right answers a minute), keyed by `flashLevelKey`. */
  readonly pace?: Readonly<Record<string, number>>;
  readonly width: number;
  /** All six nodes are laid out to fit exactly this height — never scrolls. */
  readonly height: number;
  readonly onSelect: (level: number) => void;
  /** False while the casino itself is locked: every node reads locked, no START flag. */
  readonly interactive?: boolean;
  /** DEV: every level is tappable regardless of progress. */
  readonly unlockAll?: boolean;
  /** The Modern look: the mock's fixed winding layout in the arcade chrome. */
  readonly modern?: boolean;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function levelNodeState(
  progress: FlashProgress,
  mapId: number,
  level: number,
  interactive: boolean,
  unlockAll: boolean,
): LevelNodeState {
  if (!interactive) {
    return 'locked';
  }
  if (unlockAll && !isFlashLevelDone(progress, mapId, level)) {
    return 'current';
  }
  return nodeState(progress, mapId, level);
}

/**
 * The level's own art where the casino has it (Luna Luxe: the cards and
 * decks each drill is about); elsewhere chip art climbs the denominations
 * as the ladder climbs.
 */
function artForLevel(map: CasinoMap, level: number): { source: number; scale: number } {
  const art = LEVEL_ART[map.id]?.[level];
  if (art !== undefined) {
    return { source: art, scale: LEVEL_ART_SCALE };
  }
  const set = CHIP_SETS[map.chipSetKey] ?? CHIP_SETS.default;
  const denominations = Object.keys(set)
    .map(Number)
    .sort((a, b) => a - b);
  const denomination = denominations[Math.min(level - 1, denominations.length - 1)];
  return { source: set[denomination], scale: 1 };
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
  pace = {},
  width,
  height,
  onSelect,
  interactive = true,
  unlockAll = false,
  modern = false,
}: LevelPathProps) {
  const levels = trainingLevelsForMap(map.id);
  const count = levels.length;
  if (modern) {
    return (
      <ModernLevelPath
        map={map}
        progress={progress}
        width={width}
        height={height}
        onSelect={onSelect}
        interactive={interactive}
        unlockAll={unlockAll}
      />
    );
  }
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
          pace={pace[flashLevelKey(map.id, spec.level)]}
          art={artForLevel(map, spec.level).source}
          artScale={artForLevel(map, spec.level).scale}
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
  /** Best pace on this level, once it has been cleared. */
  readonly pace?: number;
  readonly art: number;
  readonly artScale: number;
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
  pace,
  art,
  artScale,
  center,
  nodeSize,
  labelWidth,
  labelSide,
  onPress,
}: LevelNodeProps) {
  const locked = state === 'locked';
  const levelArt = artScale !== 1;
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
        {locked && !levelArt ? (
          <View
            style={[
              styles.lockedDisc,
              { width: nodeSize * 0.86, height: nodeSize * 0.86, borderRadius: nodeSize },
            ]}
          />
        ) : null}
        {/* A locked chip dims over its disc; locked level art goes to a gray silhouette. */}
        <Image
          source={art}
          style={[
            { width: nodeSize * artScale, height: nodeSize * artScale },
            locked && (levelArt ? styles.artLocked : styles.chipLocked),
          ]}
          tintColor={locked && levelArt ? colors.textMuted : undefined}
          contentFit="contain"
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
        <View
          style={styles.starsRow}
          accessibilityLabel={`${stars} of 3 stars${pace ? `, best pace ${pace} a minute` : ''}`}
        >
          <View style={styles.stars}>
            {[0, 1, 2].map((index) => (
              <Ionicons
                key={index}
                name={index < stars ? 'star' : 'star-outline'}
                size={13}
                color={index < stars ? colors.goldBright : colors.textMuted}
              />
            ))}
          </View>
          {pace ? <Text style={styles.pace}>{pace}/min</Text> : null}
        </View>
      </View>
    </View>
  );
}

type ModernLevelPathProps = Omit<LevelPathProps, 'pace' | 'modern' | 'interactive' | 'unlockAll'> & {
  readonly interactive: boolean;
  readonly unlockAll: boolean;
};

/**
 * The Modern ladder: the mock's winding layout scaled to the area it gets,
 * the level art drawn plain at 72pt, a gold dashed trail running under the
 * nodes, pixel-face titles with gold stars, and the arcade flag and badges.
 */
function ModernLevelPath({
  map,
  progress,
  width,
  height,
  onSelect,
  interactive,
  unlockAll,
}: ModernLevelPathProps) {
  const levels = trainingLevelsForMap(map.id);
  const scale = Math.min(width / MODERN_MOCK_WIDTH, height / MODERN_MOCK_HEIGHT);
  const nodeSize = Math.round(Math.min(MODERN_NODE, Math.max(MODERN_MIN_NODE, MODERN_NODE * scale)));
  const centers: Point[] = levels.map((_, index) => {
    const spot = MODERN_NODES[index % MODERN_NODES.length];
    return { x: spot.x * width, y: spot.y * height };
  });
  const nextLevel = interactive ? nextFlashLevel(progress, map.id) : null;
  const labelInset = nodeSize / 2 + MODERN_LABEL_GAP;

  /** The title runs from the node toward the card centre, never past the edge. */
  function labelFor(index: number): { side: 'left' | 'right'; width: number } {
    const side = MODERN_NODES[index % MODERN_NODES.length].side;
    const center = centers[index];
    const room = side === 'right' ? width - center.x - labelInset : center.x - labelInset;
    return { side, width: Math.max(0, Math.min(MODERN_LABEL_MAX, Math.floor(room))) };
  }

  return (
    <View style={{ width, height }}>
      {centers.slice(1).map((to, index) => (
        <TrailSegment
          key={index}
          from={centers[index]}
          to={to}
          bend={MODERN_BEND}
          nodeSize={nodeSize}
          modern
        />
      ))}
      {levels.map((spec, index) => (
        <ModernLevelNode
          key={spec.level}
          level={spec.level}
          title={spec.title}
          state={levelNodeState(progress, map.id, spec.level, interactive, unlockAll)}
          isStart={spec.level === nextLevel}
          stars={flashStars(progress, map.id, spec.level)}
          art={artForLevel(map, spec.level).source}
          center={centers[index]}
          nodeSize={nodeSize}
          labelWidth={labelFor(index).width}
          labelSide={labelFor(index).side}
          onPress={() => onSelect(spec.level)}
        />
      ))}
    </View>
  );
}

type ModernLevelNodeProps = Omit<LevelNodeProps, 'pace' | 'artScale'>;

function ModernLevelNode({
  level,
  title,
  state,
  isStart,
  stars,
  art,
  center,
  nodeSize,
  labelWidth,
  labelSide,
  onPress,
}: ModernLevelNodeProps) {
  const locked = state === 'locked';
  return (
    <View
      style={[
        styles.node,
        { left: center.x - nodeSize / 2, top: center.y - nodeSize / 2, width: nodeSize },
      ]}
    >
      {isStart ? (
        <View style={[styles.modernFlag, { top: -MODERN_FLAG_LIFT }]} pointerEvents="none">
          <ArcadeFlag label="Start" />
        </View>
      ) : null}
      <PressableScale
        accessibilityLabel={`Level ${level}: ${title}${locked ? ', locked' : ''}`}
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPress={onPress}
        style={[
          styles.chipWrap,
          { width: nodeSize, height: nodeSize },
          state === 'current' ? styles.modernArtCurrent : !locked && styles.modernArtShadow,
        ]}
      >
        {/* Locked art dims, with a muted silhouette laid over it to wash the colour out
            (no grayscale filter without a native image library); the badge sits on the corner. */}
        <Image
          source={art}
          style={[{ width: nodeSize, height: nodeSize }, locked && styles.modernArtLocked]}
          contentFit="contain"
        />
        {locked ? (
          <Image
            source={art}
            style={[StyleSheet.absoluteFill, styles.modernArtWash]}
            tintColor={colors.arcadeMuted}
            contentFit="contain"
          />
        ) : null}
        {locked ? <ArcadeBadge kind="lock" style={styles.modernBadge} /> : null}
        {state === 'done' ? <ArcadeBadge kind="check" style={styles.modernBadge} /> : null}
      </PressableScale>

      <View
        pointerEvents="none"
        style={[
          styles.modernLabel,
          { height: nodeSize, width: labelWidth },
          labelSide === 'right'
            ? { left: nodeSize + MODERN_LABEL_GAP, alignItems: 'flex-start' }
            : { right: nodeSize + MODERN_LABEL_GAP, alignItems: 'flex-end' },
        ]}
      >
        <Text
          style={[
            styles.modernTitle,
            locked && styles.modernTitleLocked,
            labelSide === 'left' && styles.titleRightAligned,
          ]}
          numberOfLines={2}
        >
          {`${level}. ${title}`.toUpperCase()}
        </Text>
        <View style={styles.stars} accessibilityLabel={`${stars} of 3 stars`}>
          {[0, 1, 2].map((index) => (
            <Ionicons
              key={index}
              name={index < stars ? 'star' : 'star-outline'}
              size={16}
              color={index < stars ? colors.arcadeGold : colors.arcadeMuted}
              style={arcadeShadow.soft}
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

interface DashMetrics {
  readonly dash: number;
  readonly gap: number;
  /** Arc length left clear at each end of the run. */
  readonly trim: number;
}

/** Dashes spaced evenly along the run's arc, trimmed clear of both chips. */
function dashesAlong(from: Point, to: Point, bend: number, nodeSize: number, metrics?: DashMetrics): Dash[] {
  const dash = metrics?.dash ?? DASH;
  const gap = metrics?.gap ?? DASH_GAP;
  const trim = metrics?.trim ?? nodeSize / 2 + 6;
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
  const inner = Math.max(0, total - trim * 2);
  const count = Math.max(0, Math.floor((inner + gap) / (dash + gap)));
  const used = count * dash + Math.max(0, count - 1) * gap;
  const start = trim + (inner - used) / 2 + dash / 2;

  const dashes: Dash[] = [];
  let cursor = 1;
  for (let index = 0; index < count; index += 1) {
    const distance = start + index * (dash + gap);
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
  /** Modern: finer gold dashes running centre to centre, under the nodes. */
  readonly modern?: boolean;
}

const MODERN_DASH_METRICS: DashMetrics = { dash: MODERN_DASH, gap: MODERN_DASH_GAP, trim: 0 };

/** Run of gold dashes from one chip to the next — straight or winding. */
function TrailSegment({ from, to, bend, nodeSize, modern = false }: TrailSegmentProps) {
  const dashes = useMemo(
    () => dashesAlong(from, to, bend, nodeSize, modern ? MODERN_DASH_METRICS : undefined),
    [from, to, bend, nodeSize, modern],
  );
  const dashWidth = modern ? MODERN_DASH : DASH;
  const dashHeight = modern ? MODERN_DASH_HEIGHT : DASH_HEIGHT;
  return (
    <>
      {dashes.map((dash, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            modern ? styles.modernDash : styles.dash,
            {
              left: dash.x - dashWidth / 2,
              top: dash.y - dashHeight / 2,
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
  artLocked: {
    opacity: 0.8,
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
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  pace: {
    color: colors.textMuted,
    fontSize: fontSizes.caption - 1,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
  dash: {
    position: 'absolute',
    width: DASH,
    height: DASH_HEIGHT,
    borderRadius: 2,
    backgroundColor: colors.goldDim,
  },

  // Modern
  modernFlag: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  /** The level in play glows gold; cleared art casts a plain drop shadow. */
  modernArtCurrent: {
    shadowColor: colors.arcadeGlow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  modernArtShadow: {
    shadowColor: colors.arcadeInk,
    shadowOpacity: 0.6,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  modernArtLocked: {
    opacity: 0.5,
  },
  modernArtWash: {
    opacity: 0.45,
  },
  modernBadge: {
    position: 'absolute',
    right: 2,
    bottom: 0,
  },
  modernLabel: {
    position: 'absolute',
    top: 0,
    justifyContent: 'center',
    gap: 2,
  },
  modernTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 20,
    letterSpacing: 0.5,
    color: colors.arcadeCream,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  modernTitleLocked: {
    color: colors.arcadeMuted,
  },
  modernDash: {
    position: 'absolute',
    width: MODERN_DASH,
    height: MODERN_DASH_HEIGHT,
    borderRadius: MODERN_DASH_HEIGHT / 2,
    backgroundColor: colors.arcadeGold,
    opacity: 0.75,
  },
});
