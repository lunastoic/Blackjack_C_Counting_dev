import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CHIP_SETS, LEVEL_ART, REWARD_ART } from '../../assets/registry';
import { CasinoMap } from '../../engine/betting/casino';
import {
  FlashProgress,
  flashLevelKey,
  flashStars,
  isFlashLevelDone,
  isFlashLevelUnlocked,
  mapRewards,
  nextFlashLevel,
  REWARD_LEVEL,
  REWARD_SLOTS,
  rewardState,
  RewardSlot,
  RewardState,
  trainingLevelsForMap,
} from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
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
 * Modern: the ladder is a river. The six levels and the two mystery rewards
 * are waypoints the trail winds through in order — each reward sits on the
 * trail between the level that opens it and the next — and every casino
 * cuts its own course from its own seed, so no two ladders bend alike.
 */
const RIVER_X_MIN = 0.17;
const RIVER_X_MAX = 0.83;
const RIVER_Y_TOP = 0.1;
const RIVER_Y_BOTTOM = 0.91;
/** A run that carries a reward falls this much further than a plain one. */
const RIVER_REWARD_RUN = 1.5;
/** Sideways swing of a crossing, as a share of the width — longer when a reward rides it. */
const RIVER_LEVEL_SWING: readonly [number, number] = [0.34, 0.62];
const RIVER_REWARD_SWING: readonly [number, number] = [0.42, 0.66];
/** Where on its crossing a reward sits: part way across, part way down. */
const RIVER_REWARD_ALONG: readonly [number, number] = [0.45, 0.58];
const RIVER_REWARD_DOWN: readonly [number, number] = [0.44, 0.56];
/** Now and then the river drifts on along the same bank instead of crossing. */
const RIVER_DRIFT_CHANCE = 0.12;
const RIVER_DRIFT_SWING: readonly [number, number] = [0.14, 0.22];
/** The flattest move worth keeping once clamped to the banks; flatter is redrawn. */
const RIVER_MIN_MOVE = 0.12;
/** A crossing with a reward on it must stay wide, so the reward clears the START flag below. */
const RIVER_REWARD_MIN_MOVE = 0.42;
const RIVER_ATTEMPTS = 64;
/** Clear water kept between any two pieces of art on the trail. */
const RIVER_CLEARANCE = 6;
/** Samples per bend when laying dashes along the river. */
const RIVER_SAMPLES = 24;
/** Reference ladder the node size scales against. */
const MODERN_MOCK_WIDTH = 323;
const MODERN_MOCK_HEIGHT = 560;
const MODERN_NODE = 64;
const MODERN_MIN_NODE = 48;
const MODERN_LABEL_MAX = 150;
const MODERN_LABEL_GAP = 6;
/** The START flag sits this far above the node's box. */
const MODERN_FLAG_LIFT = 16;
const MODERN_DASH = 9;
const MODERN_DASH_GAP = 7;
const MODERN_DASH_HEIGHT = 2.5;
/** One breath of the START node's glow, in and out. */
const MODERN_BREATH_MS = 1100;
/** A reward's box on the trail; its art draws past the box and its label sits beside it. */
const MODERN_REWARD = 40;
const REWARD_ART_SCALE = 1.2;
const REWARD_LABEL_MAX = 140;
const REWARD_LABEL_GAP = 4;

export type LevelNodeState = 'done' | 'current' | 'locked';

interface LevelPathProps {
  readonly map: CasinoMap;
  readonly progress: FlashProgress;
  /** Rewards already opened, as `rewardKey` — Modern only. */
  readonly rewardsOpened?: ReadonlySet<string>;
  /** Tapping a ready (or opened) reward on the trail. */
  readonly onReward?: (slot: RewardSlot) => void;
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
  rewardsOpened,
  onReward,
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
        rewardsOpened={rewardsOpened}
        onReward={onReward}
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

/** A stop on the river: a level, or the reward it opens. */
type Stop =
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'reward'; readonly slot: RewardSlot };

type Waypoint = Stop & Point;

/** Small, deterministic PRNG: a casino's river never moves between visits. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(rng: () => number, range: readonly [number, number]): number {
  return range[0] + (range[1] - range[0]) * rng();
}

interface RiverSpec {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly levels: number;
  readonly nodeSize: number;
  readonly rewardSize: number;
}

/**
 * Cuts the casino's river: the levels cross from bank to bank with a random
 * swing (now and then drifting on along one bank), a reward rides part way
 * along the crossing it opens — on the line itself — and that run falls
 * further to give it room. Draws from the seed until a course runs clear
 * with no two pieces of art touching, keeping the roomiest otherwise.
 */
function riverLayout({ seed, width, height, levels, nodeSize, rewardSize }: RiverSpec): Waypoint[] {
  const radius = (stop: Stop) => (stop.kind === 'level' ? nodeSize : rewardSize * REWARD_ART_SCALE) / 2;
  const top = RIVER_Y_TOP * height;
  const span = (RIVER_Y_BOTTOM - RIVER_Y_TOP) * height;
  /** The reward on the run down from a level, if it opens one (the last level's waits off the trail). */
  const rewardAfter = (level: number): RewardSlot | undefined =>
    level < levels ? REWARD_SLOTS.find((slot) => REWARD_LEVEL[slot] === level) : undefined;
  // Each run's share of the fall: one that carries a reward runs longer.
  const falls = Array.from({ length: Math.max(0, levels - 1) }, (_, run) =>
    rewardAfter(run + 1) !== undefined ? RIVER_REWARD_RUN : 1,
  );
  const unit = span / Math.max(1, falls.reduce((sum, fall) => sum + fall, 0));

  let best: Waypoint[] = [];
  let bestGap = -Infinity;
  for (let attempt = 0; attempt < RIVER_ATTEMPTS; attempt += 1) {
    const rng = mulberry32(seed * 7919 + attempt * 104729 + 17);
    // The river enters on one bank, heading for the other.
    let heading: 1 | -1 = rng() < 0.5 ? 1 : -1;
    let x =
      heading > 0
        ? between(rng, [RIVER_X_MIN, RIVER_X_MIN + 0.14])
        : between(rng, [RIVER_X_MAX - 0.14, RIVER_X_MAX]);
    let y = top;
    let fell = 0;
    const course: Waypoint[] = [{ kind: 'level', level: 1, x: x * width, y }];
    let clear = true;
    for (let run = 0; run < falls.length; run += 1) {
      const slot = rewardAfter(run + 1);
      const drift = slot === undefined && rng() < RIVER_DRIFT_CHANCE;
      const swing = between(
        rng,
        drift ? RIVER_DRIFT_SWING : slot !== undefined ? RIVER_REWARD_SWING : RIVER_LEVEL_SWING,
      );
      // A drift carries on the way the river just went; a crossing turns it.
      const way: 1 | -1 = drift ? (heading === 1 ? -1 : 1) : heading;
      const nextX = Math.min(RIVER_X_MAX, Math.max(RIVER_X_MIN, x + way * swing));
      if (Math.abs(nextX - x) < (slot !== undefined ? RIVER_REWARD_MIN_MOVE : RIVER_MIN_MOVE)) {
        clear = false;
        break;
      }
      fell += falls[run];
      const last = run === falls.length - 1;
      const nextY = top + fell * unit + (last ? 0 : (rng() - 0.5) * 0.1 * unit);
      if (slot !== undefined) {
        const along = between(rng, RIVER_REWARD_ALONG);
        const down = between(rng, RIVER_REWARD_DOWN);
        course.push({ kind: 'reward', slot, x: (x + (nextX - x) * along) * width, y: y + (nextY - y) * down });
      }
      x = nextX;
      y = nextY;
      heading = way === 1 ? -1 : 1;
      course.push({ kind: 'level', level: run + 2, x: x * width, y });
    }
    if (!clear) {
      continue;
    }
    // The tightest pair of stops decides: art must never touch.
    let gap = Infinity;
    for (let a = 0; a < course.length; a += 1) {
      for (let b = a + 1; b < course.length; b += 1) {
        const distance = Math.hypot(course[a].x - course[b].x, course[a].y - course[b].y);
        gap = Math.min(gap, distance - radius(course[a]) - radius(course[b]));
      }
    }
    if (gap >= RIVER_CLEARANCE) {
      return course;
    }
    if (gap > bestGap) {
      bestGap = gap;
      best = course;
    }
  }
  if (best.length > 0) {
    return best;
  }
  // Every draw was redrawn: a plain zigzag bank to bank, rewards half way along.
  const bank = (index: number) => (index % 2 === 0 ? RIVER_X_MIN : RIVER_X_MAX) * width;
  const plain: Waypoint[] = [{ kind: 'level', level: 1, x: bank(0), y: top }];
  let fell = 0;
  for (let run = 0; run < falls.length; run += 1) {
    const from = plain[plain.length - 1];
    fell += falls[run];
    const to = { x: bank(run + 1), y: top + fell * unit };
    const slot = rewardAfter(run + 1);
    if (slot !== undefined) {
      plain.push({ kind: 'reward', slot, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    }
    plain.push({ kind: 'level', level: run + 2, ...to });
  }
  return plain;
}

/**
 * The Modern ladder: the casino's river through its levels and rewards,
 * the level art drawn plain, a gold dashed trail running under the nodes,
 * pixel-face titles with gold stars, and the arcade flag and badges.
 */
function ModernLevelPath({
  map,
  progress,
  rewardsOpened,
  onReward,
  width,
  height,
  onSelect,
  interactive,
  unlockAll,
}: ModernLevelPathProps) {
  const levels = trainingLevelsForMap(map.id);
  const scale = Math.min(width / MODERN_MOCK_WIDTH, height / MODERN_MOCK_HEIGHT);
  const nodeSize = Math.round(Math.min(MODERN_NODE, Math.max(MODERN_MIN_NODE, MODERN_NODE * scale)));
  const rewardSize = Math.round(MODERN_REWARD * (nodeSize / MODERN_NODE));
  const course = useMemo(
    () => riverLayout({ seed: map.id, width, height, levels: levels.length, nodeSize, rewardSize }),
    [map.id, width, height, levels.length, nodeSize, rewardSize],
  );
  const nextLevel = interactive ? nextFlashLevel(progress, map.id) : null;

  /** Titles and reward labels run from their art toward the card centre, never past the edge. */
  function labelFor(center: Point, inset: number, max: number): { side: 'left' | 'right'; width: number } {
    const side = center.x < width / 2 ? 'right' : 'left';
    const room = side === 'right' ? width - center.x - inset : center.x - inset;
    return { side, width: Math.max(0, Math.min(max, Math.floor(room))) };
  }

  return (
    <View style={{ width, height }}>
      <RiverTrail course={course} />
      {rewardsOpened && onReward
        ? course.map((stop) =>
            stop.kind === 'reward' ? (
              <RewardNode
                key={`reward-${stop.slot}`}
                mapId={map.id}
                slot={stop.slot}
                state={rewardState(progress, rewardsOpened, map.id, stop.slot)}
                center={stop}
                size={rewardSize}
                pathWidth={width}
                labelSide={labelFor(stop, rewardSize / 2 + REWARD_LABEL_GAP, REWARD_LABEL_MAX).side}
                labelWidth={labelFor(stop, rewardSize / 2 + REWARD_LABEL_GAP, REWARD_LABEL_MAX).width}
                onPress={() => onReward(stop.slot)}
              />
            ) : null,
          )
        : null}
      {course.map((stop) => {
        const spec = stop.kind === 'level' ? levels.find((level) => level.level === stop.level) : undefined;
        if (!spec) {
          return null;
        }
        const label = labelFor(stop, nodeSize / 2 + MODERN_LABEL_GAP, MODERN_LABEL_MAX);
        return (
          <ModernLevelNode
            key={spec.level}
            level={spec.level}
            title={spec.title}
            state={levelNodeState(progress, map.id, spec.level, interactive, unlockAll)}
            isStart={spec.level === nextLevel}
            stars={flashStars(progress, map.id, spec.level)}
            art={artForLevel(map, spec.level).source}
            center={stop}
            nodeSize={nodeSize}
            labelWidth={label.width}
            labelSide={label.side}
            onPress={() => onSelect(spec.level)}
          />
        );
      })}
    </View>
  );
}

interface RewardNodeProps {
  readonly mapId: number;
  readonly slot: RewardSlot;
  readonly state: RewardState;
  readonly center: Point;
  readonly size: number;
  readonly pathWidth: number;
  /** The side its label runs along — toward the card centre — and the room it has. */
  readonly labelSide: 'left' | 'right';
  readonly labelWidth: number;
  readonly onPress: () => void;
}

/**
 * A mystery reward on the trail: wrapped and dim until its level is cleared,
 * breathing gold when it is ready to open, and showing what it gave — the
 * tool, or the drill the bag carried — once opened. Its label sits beside
 * it, so the river keeps its spacing.
 */
function RewardNode({
  mapId,
  slot,
  state,
  center,
  size,
  pathWidth,
  labelSide,
  labelWidth,
  onPress,
}: RewardNodeProps) {
  const reducedMotion = useReducedMotion();
  const rewards = mapRewards(mapId);
  const ready = state === 'ready';
  const opened = state === 'opened';

  // Ready rewards breathe like the START node, so the eye finds them.
  const breath = useSharedValue(0);
  useEffect(() => {
    if (ready && !reducedMotion) {
      breath.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: MODERN_BREATH_MS, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: MODERN_BREATH_MS, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(breath);
      breath.set(0);
    }
    return () => cancelAnimation(breath);
  }, [ready, reducedMotion, breath]);
  const breathStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.35 + breath.value * 0.55,
    shadowRadius: 5 + breath.value * 11,
    transform: [{ scale: 1 + breath.value * 0.06 }],
  }));

  if (!rewards) {
    return null;
  }
  const art = opened
    ? slot === 1
      ? REWARD_ART.tool[rewards.tool.id]
      : REWARD_ART.drill[rewards.drill.id]
    : slot === 1
      ? REWARD_ART.gift[mapId]
      : REWARD_ART.bag[mapId];
  const label = opened
    ? slot === 1
      ? rewards.tool.short
      : `▶ ${rewards.drill.name}`
    : ready
      ? 'Tap to open'
      : 'Mystery reward';
  const artSize = Math.round(size * REWARD_ART_SCALE);
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.rewardSlot,
        { top: center.y - size / 2, height: size },
        labelSide === 'right'
          ? { left: center.x - size / 2, flexDirection: 'row' }
          : { right: pathWidth - center.x - size / 2, flexDirection: 'row-reverse' },
      ]}
    >
      <PressableScale
        accessibilityLabel={
          opened
            ? slot === 1
              ? `${rewards.tool.name}, opened`
              : `${rewards.drill.name} drill`
            : ready
              ? `Mystery reward, ready to open`
              : `Mystery reward, locked until level ${REWARD_LEVEL[slot]}`
        }
        accessibilityState={{ disabled: state === 'locked' }}
        disabled={state === 'locked'}
        onPress={onPress}
        style={[styles.rewardTap, { width: size, height: size }]}
      >
        <Animated.View style={[styles.rewardGlow, ready && breathStyle, { width: size, height: size }]}>
          <Image
            source={art}
            style={[
              { width: artSize, height: artSize },
              state === 'locked' && styles.rewardLocked,
            ]}
            contentFit="contain"
            transition={120}
          />
        </Animated.View>
        {state === 'locked' ? (
          <ArcadeBadge kind="lock" style={styles.rewardBadge} />
        ) : null}
      </PressableScale>
      <View
        style={[
          styles.rewardPill,
          { maxWidth: labelWidth },
          ready && styles.rewardPillReady,
          opened && styles.rewardPillOpened,
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.rewardPillText, ready && styles.rewardPillTextReady]} numberOfLines={1}>
          {label}
        </Text>
      </View>
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
  const reducedMotion = useReducedMotion();

  // The START node breathes: its gold halo swells and its art lifts a touch,
  // so the level to play next is the obvious first tap on a fresh map.
  const breath = useSharedValue(0);
  useEffect(() => {
    if (isStart && !reducedMotion) {
      breath.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: MODERN_BREATH_MS, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: MODERN_BREATH_MS, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(breath);
      breath.set(isStart ? 0.6 : 0);
    }
    return () => cancelAnimation(breath);
  }, [isStart, reducedMotion, breath]);
  const breathStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.6 + breath.value * 0.4,
    shadowRadius: 6 + breath.value * 10,
    transform: [{ scale: 1 + breath.value * 0.04 }],
  }));

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
          // The START node carries its own breathing halo below.
          isStart
            ? undefined
            : state === 'current'
              ? styles.modernArtCurrent
              : !locked && styles.modernArtShadow,
        ]}
      >
        {/* Locked art dims, with a muted silhouette laid over it to wash the colour out
            (no grayscale filter without a native image library); the badge sits on the corner. */}
        <Animated.View style={isStart ? [styles.modernArtCurrent, breathStyle] : undefined}>
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
        </Animated.View>
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
              size={14}
              color={index < stars ? colors.arcadeGold : colors.arcadeMuted}
              style={arcadeShadow.soft}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Point on the cubic from `a` to `d`, pulled by the control points `b` and `c`. */
function cubicPoint(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  const wa = u * u * u;
  const wb = 3 * u * u * t;
  const wc = 3 * u * t * t;
  const wd = t * t * t;
  return {
    x: wa * a.x + wb * b.x + wc * c.x + wd * d.x,
    y: wa * a.y + wb * b.y + wc * c.y + wd * d.y,
  };
}

/** Point on the run from `from` to `to`: straight at bend 0, a full S at bend 1. */
function curvePoint(from: Point, to: Point, bendRatio: number, t: number): Point {
  const bend = (to.y - from.y) * bendRatio;
  return cubicPoint(from, { x: from.x, y: from.y + bend }, { x: to.x, y: to.y - bend }, to, t);
}

/** The river as one smooth line through its waypoints: Catmull-Rom bends, sampled. */
function riverLine(points: readonly Point[]): Point[] {
  const line: Point[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[Math.max(index - 1, 0)];
    const from = points[index];
    const to = points[index + 1];
    const after = points[Math.min(index + 2, points.length - 1)];
    const out = { x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 };
    const into = { x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 };
    for (let sample = index === 0 ? 0 : 1; sample <= RIVER_SAMPLES; sample += 1) {
      line.push(cubicPoint(from, out, into, to, sample / RIVER_SAMPLES));
    }
  }
  return line;
}

interface Dash {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Dashes spaced evenly along a sampled line's arc, trimmed clear of both ends. */
function dashesOnLine(points: readonly Point[], dash: number, gap: number, trim: number): Dash[] {
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

/** Dashes along one run between chips, trimmed clear of both. */
function dashesAlong(from: Point, to: Point, bend: number, nodeSize: number): Dash[] {
  const points = Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) =>
    curvePoint(from, to, bend, index / CURVE_SAMPLES),
  );
  return dashesOnLine(points, DASH, DASH_GAP, nodeSize / 2 + 6);
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

/** The Modern trail: fine gold dashes along the whole river, under the nodes. */
function RiverTrail({ course }: { readonly course: readonly Point[] }) {
  const dashes = useMemo(() => dashesOnLine(riverLine(course), MODERN_DASH, MODERN_DASH_GAP, 0), [course]);
  return (
    <>
      {dashes.map((dash, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.modernDash,
            {
              left: dash.x - MODERN_DASH / 2,
              top: dash.y - MODERN_DASH_HEIGHT / 2,
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
  rewardSlot: {
    position: 'absolute',
    alignItems: 'center',
    gap: REWARD_LABEL_GAP,
    zIndex: 3,
  },
  rewardTap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The gold breath on a reward that is ready to open. */
  rewardGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.arcadeGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  rewardLocked: {
    opacity: 0.55,
  },
  rewardBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
  },
  rewardPill: {
    borderRadius: radii.sm,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    backgroundColor: colors.arcadePlaque,
    paddingHorizontal: spacing.xs + 2,
    paddingTop: 1,
    paddingBottom: 2,
  },
  rewardPillReady: {
    backgroundColor: colors.arcadeGreen,
  },
  rewardPillOpened: {
    backgroundColor: colors.arcadePlaqueDeep,
  },
  rewardPillText: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.arcadeGold,
    textTransform: 'uppercase',
    includeFontPadding: false,
    ...arcadeShadow.soft,
  },
  rewardPillTextReady: {
    color: colors.arcadeCream,
  },
  modernFlag: {
    position: 'absolute',
    left: -MODERN_FLAG_LIFT,
    right: -MODERN_FLAG_LIFT,
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
    fontSize: 17,
    lineHeight: 18,
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
