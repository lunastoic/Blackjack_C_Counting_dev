import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, durations, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { BetAdvice } from '../../utils/countCoach';
import { ArcadeTag } from '../arcade';
import { BetCallout } from './BetCallout';

/** Visual meter clamps to ±10; stored count is never clamped. */
const METER_RANGE = 10;
const BAR_WIDTH = 10;
const RAIL_WIDTH = 58;
const INDICATOR_HEIGHT = 24;
const MIN_RAIL_HEIGHT = 220;
const MAX_RAIL_HEIGHT = 280;
/** Modern: the ink-outlined track, its drop to the right, and the plaque tag beside it. */
const MODERN_TRACK_WIDTH = 16;
const MODERN_TRACK_DROP = 3;
const MODERN_HEAD_HEIGHT = 3;
const MODERN_TAG_LEFT = 24;
const MODERN_TAG_MIN_WIDTH = 38;
/**
 * Room for the widest label ("−12" in the display face). The slot hangs off a
 * track only MODERN_TRACK_WIDTH wide, and an absolute child with no width is
 * bounded by its parent's — the tag would hold its minimum and clip "+1" to "+".
 */
const MODERN_TAG_SLOT_WIDTH = 120;
/** Modern rail sits this much below centre, clear of the discard pile's count. */
const MODERN_RAIL_DROP = spacing.lg;
/** ArcadeTag: 24 line + 2 pad + 2×2 outline = 30 face (centred at 15) over a 3 drop. */
const MODERN_TAG_HALF = 15;
const MODERN_TAG_HEIGHT = 33;
const MODERN_RAIL_STOPS = [0, 0.45, 0.7, 1] as const;

/** Horizontal space the count rail occupies (padding + bar + value tag). */
export const COUNT_RAIL_CLEARANCE = layout.screenPaddingH + RAIL_WIDTH;

const METER_GREEN = colors.trainingPlus;
const METER_MID = '#E0B94D';
const METER_RED = colors.trainingMinus;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function lerpColor(from: string, to: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const t = Math.min(1, Math.max(0, amount));
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Matches the vertical meter gradient at the indicator position. */
function meterColorAtRatio(ratio: number): string {
  if (ratio <= 0.5) {
    return lerpColor(METER_GREEN, METER_MID, ratio / 0.5);
  }
  return lerpColor(METER_MID, METER_RED, (ratio - 0.5) / 0.5);
}

function meterColorForCount(runningCount: number): string {
  return meterColorAtRatio(countToYRatio(runningCount));
}

function countToYRatio(runningCount: number): number {
  const clamped = Math.max(-METER_RANGE, Math.min(METER_RANGE, runningCount));
  return (METER_RANGE - clamped) / (METER_RANGE * 2);
}

function formatCountLabel(runningCount: number): string {
  return runningCount > 0 ? `+${runningCount}` : `${runningCount}`;
}

function VerticalCountMeter({
  runningCount,
  railHeight,
  advice,
}: {
  runningCount: number;
  railHeight: number;
  advice: BetAdvice | null;
}) {
  const reducedMotion = useReducedMotion();
  const trackHeight = useSharedValue(railHeight);
  const yRatio = useSharedValue(countToYRatio(runningCount));

  useEffect(() => {
    trackHeight.value = railHeight;
  }, [railHeight, trackHeight]);

  useEffect(() => {
    const target = countToYRatio(runningCount);
    yRatio.value = reducedMotion
      ? target
      : withTiming(target, { duration: durations.normal });
  }, [runningCount, reducedMotion, yRatio]);

  const indicatorStyle = useAnimatedStyle(() => {
    const centerY = yRatio.value * trackHeight.value;
    const top = Math.min(
      Math.max(centerY - INDICATOR_HEIGHT / 2, 0),
      Math.max(0, trackHeight.value - INDICATOR_HEIGHT),
    );
    return { top };
  });

  const label = formatCountLabel(runningCount);
  const meterColor = meterColorForCount(runningCount);

  return (
    <View
      style={[styles.meterTrack, { height: railHeight }]}
      accessibilityLabel={`Count meter at ${runningCount}`}
    >
      <LinearGradient
        colors={[colors.trainingPlus, '#E0B94D', colors.trainingMinus]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.meterGradient}
      />
      <View style={styles.centerTick} pointerEvents="none" />
      <Text style={[styles.poleLabel, styles.poleTop]}>+{METER_RANGE}</Text>
      <Text style={[styles.poleLabel, styles.poleBottom]}>−{METER_RANGE}</Text>

      <Animated.View style={[styles.indicatorRow, indicatorStyle]}>
        <View style={[styles.tickBar, { backgroundColor: meterColor, shadowColor: meterColor }]} />
        <View style={[styles.valueTag, { borderColor: `${meterColor}AA` }]}>
          <Text style={[styles.valueText, { color: meterColor }]}>{label}</Text>
        </View>
        {/* The coach's bet tip hangs off the tag and rides with it. */}
        {advice ? (
          <BetCallout
            advice={advice}
            left={RAIL_WIDTH + spacing.xxs}
            centerY={INDICATOR_HEIGHT / 2}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * Modern: the bevel track (ink outline, ink drop to the right) with the
 * green→red gradient, a cream head riding the count and a plaque tag beside
 * it. Fogged, the gradient dims, the head parks at zero and the tag reads "?".
 */
function ModernCountMeter({
  runningCount,
  railHeight,
  advice,
  masked,
}: {
  runningCount: number;
  railHeight: number;
  advice: BetAdvice | null;
  masked: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const trackHeight = useSharedValue(railHeight);
  const yRatio = useSharedValue(masked ? 0.5 : countToYRatio(runningCount));

  useEffect(() => {
    trackHeight.value = railHeight;
  }, [railHeight, trackHeight]);

  useEffect(() => {
    const target = masked ? 0.5 : countToYRatio(runningCount);
    yRatio.value =
      reducedMotion || masked ? target : withTiming(target, { duration: durations.normal });
  }, [runningCount, masked, reducedMotion, yRatio]);

  const headStyle = useAnimatedStyle(() => {
    const centerY = yRatio.value * trackHeight.value;
    const top = Math.min(
      Math.max(centerY - MODERN_HEAD_HEIGHT / 2, 0),
      Math.max(0, trackHeight.value - MODERN_HEAD_HEIGHT),
    );
    return { top };
  });

  const tagStyle = useAnimatedStyle(() => {
    const centerY = yRatio.value * trackHeight.value;
    const top = Math.min(
      Math.max(centerY - MODERN_TAG_HALF, 0),
      Math.max(0, trackHeight.value - MODERN_TAG_HEIGHT),
    );
    return { top };
  });

  const label = masked ? '?' : formatCountLabel(runningCount);

  return (
    <View
      style={[styles.modernBox, { height: railHeight }]}
      accessibilityLabel={masked ? undefined : `Count meter at ${runningCount}`}
    >
      <View style={styles.modernDrop} />
      <View style={styles.modernTrack}>
        <LinearGradient
          colors={[colors.meterFull, colors.meterHigh, colors.meterMid, colors.meterLow]}
          locations={[...MODERN_RAIL_STOPS]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.modernGradient, masked && styles.modernGradientMasked]}
        />
        <View style={styles.modernTick} pointerEvents="none" />
        <Animated.View style={[styles.modernHead, headStyle]} />
      </View>
      <Animated.View style={[styles.modernTagSlot, tagStyle]} pointerEvents="box-none">
        <ArcadeTag label={label} style={styles.modernTag} />
        {/* The coach's bet tip hangs off the tag's right edge and rides with it. */}
        {advice && !masked ? (
          <View style={styles.modernCalloutAnchor}>
            <BetCallout advice={advice} left={spacing.xs} centerY={MODERN_TAG_HALF} />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

interface CountRailProps {
  /** Fog of war: the meter tracks the count but shows "?" until it is proven. */
  readonly masked?: boolean;
  /** Tapping the fogged meter challenges the player to reveal it. */
  readonly onPressMasked?: () => void;
  /** The coach's bet tip to hang off the indicator (live meter only). */
  readonly advice?: BetAdvice | null;
}

/** Vertical running-count meter, centered along the left edge of the table. */
export function CountRail({ masked = false, onPressMasked, advice = null }: CountRailProps) {
  const runningCount = useGameSessionStore((state) => state.runningCount);
  const { height: windowHeight } = useWindowDimensions();
  const railHeight = Math.min(MAX_RAIL_HEIGHT, Math.max(MIN_RAIL_HEIGHT, windowHeight * 0.36));
  const modern = useModernUi();

  if (modern) {
    if (masked) {
      return (
        <View style={[styles.rail, styles.railModern]}>
          <Pressable
            onPress={onPressMasked}
            accessibilityLabel="Count meter hidden — tap to prove your count and reveal it"
            accessibilityRole="button"
          >
            <ModernCountMeter runningCount={runningCount} railHeight={railHeight} advice={null} masked />
          </Pressable>
        </View>
      );
    }
    return (
      <View style={[styles.rail, styles.railModern]} pointerEvents="none">
        <ModernCountMeter
          runningCount={runningCount}
          railHeight={railHeight}
          advice={advice}
          masked={false}
        />
      </View>
    );
  }

  if (masked) {
    return (
      <View style={styles.rail}>
        <Pressable
          onPress={onPressMasked}
          accessibilityLabel="Count meter hidden — tap to prove your count and reveal it"
          accessibilityRole="button"
          style={[styles.meterTrack, { height: railHeight }]}
        >
          <LinearGradient
            colors={[colors.trainingPlus, '#E0B94D', colors.trainingMinus]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.meterGradient, styles.meterGradientMasked]}
          />
          <View style={styles.centerTick} pointerEvents="none" />
          <Text style={[styles.poleLabel, styles.poleTop]}>+{METER_RANGE}</Text>
          <Text style={[styles.poleLabel, styles.poleBottom]}>−{METER_RANGE}</Text>

          <View
            style={[
              styles.indicatorRow,
              { top: railHeight / 2 - INDICATOR_HEIGHT / 2 },
            ]}
          >
            <View style={[styles.tickBar, styles.tickBarMasked]} />
            <View style={[styles.valueTag, styles.valueTagMasked]}>
              <Text style={[styles.valueText, styles.valueTextMasked]}>?</Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.rail} pointerEvents="none">
      <VerticalCountMeter runningCount={runningCount} railHeight={railHeight} advice={advice} />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: layout.screenPaddingH,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  meterTrack: {
    width: RAIL_WIDTH,
  },
  meterGradient: {
    position: 'absolute',
    left: 0,
    width: BAR_WIDTH,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
    opacity: 0.92,
  },
  meterGradientMasked: {
    opacity: 0.25,
  },
  tickBarMasked: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
  },
  valueTagMasked: {
    borderColor: colors.borderGold,
  },
  valueTextMasked: {
    color: colors.gold,
  },
  centerTick: {
    position: 'absolute',
    left: -3,
    top: '50%',
    marginTop: -1,
    width: BAR_WIDTH + 6,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1,
  },
  poleLabel: {
    position: 'absolute',
    left: 0,
    width: BAR_WIDTH,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  poleTop: {
    top: -2,
  },
  poleBottom: {
    bottom: -2,
  },
  indicatorRow: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: INDICATOR_HEIGHT,
    gap: spacing.xs,
    zIndex: 1,
  },
  tickBar: {
    width: BAR_WIDTH + 6,
    height: 4,
    marginLeft: -3,
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  valueTag: {
    minWidth: 34,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(12, 10, 9, 0.88)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    lineHeight: fontSizes.subtitle,
  },
  /* Modern */
  railModern: {
    zIndex: 2,
    transform: [{ translateY: MODERN_RAIL_DROP }],
  },
  modernBox: {
    width: MODERN_TRACK_WIDTH,
  },
  /** The track's ink drop, cast to the right rather than down. */
  modernDrop: {
    position: 'absolute',
    left: MODERN_TRACK_DROP,
    top: 0,
    bottom: 0,
    width: MODERN_TRACK_WIDTH,
    borderRadius: MODERN_TRACK_WIDTH / 2,
    backgroundColor: colors.arcadeInk,
  },
  modernTrack: {
    flex: 1,
    width: MODERN_TRACK_WIDTH,
    borderRadius: MODERN_TRACK_WIDTH / 2,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    backgroundColor: colors.overlay,
    overflow: 'hidden',
  },
  modernGradient: {
    ...StyleSheet.absoluteFill,
    borderRadius: MODERN_TRACK_WIDTH / 2 - 2,
    opacity: 0.9,
  },
  modernGradientMasked: {
    opacity: 0.3,
  },
  modernTick: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: colors.arcadeInk,
    opacity: 0.45,
  },
  modernHead: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: MODERN_HEAD_HEIGHT,
    borderRadius: MODERN_HEAD_HEIGHT / 2,
    backgroundColor: colors.arcadeCream,
    shadowColor: colors.arcadeCream,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  modernTagSlot: {
    position: 'absolute',
    left: MODERN_TAG_LEFT,
    width: MODERN_TAG_SLOT_WIDTH,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  modernTag: {
    minWidth: MODERN_TAG_MIN_WIDTH,
  },
  modernCalloutAnchor: {
    width: 0,
    height: MODERN_TAG_HEIGHT,
  },
});
