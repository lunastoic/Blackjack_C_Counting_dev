import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomOut,
} from 'react-native-reanimated';
import { CHIP_RUSH_STACKS } from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { LaneCard } from '../../stores/chipRushStore';
import { colors, fonts } from '../../theme';
import { formatCount } from '../../utils/countCoach';

/** Width of a true-count card on the lane. */
export const LANE_CARD_WIDTH = 72;
/** The red edge a card must not reach. */
const EDGE_WIDTH = 10;

interface LaneCardViewProps {
  readonly card: LaneCard;
  readonly laneWidth: number;
  readonly front: boolean;
}

/** One true-count card sliding from the right of the lane to the edge, timed from its spawn. */
function LaneCardView({ card, laneWidth, front }: LaneCardViewProps) {
  const reducedMotion = useReducedMotion();
  const startX = Math.max(EDGE_WIDTH, laneWidth - LANE_CARD_WIDTH);
  const endX = EDGE_WIDTH;
  // Starts at the right edge; the effect places it where its clock says and slides it on.
  const x = useSharedValue(startX);

  useEffect(() => {
    const now = Date.now();
    const done = Math.min(1, Math.max(0, (now - card.spawnAt) / card.crossMs));
    x.value = startX - (startX - endX) * done;
    x.value = withTiming(endX, {
      duration: Math.max(0, card.crossMs - (now - card.spawnAt)),
      easing: Easing.linear,
    });
  }, [card.spawnAt, card.crossMs, startX, endX, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Animated.View
      exiting={reducedMotion ? undefined : ZoomOut.duration(160)}
      style={[styles.card, front && styles.cardFront, style]}
      accessibilityLabel={`True count ${formatCount(card.trueCount)}${front ? ', bet on this one' : ''}`}
    >
      <Text style={styles.cardKicker}>TRUE</Text>
      <Text style={styles.cardValue}>{formatCount(card.trueCount)}</Text>
    </Animated.View>
  );
}

interface ChipRushLaneProps {
  readonly cards: readonly LaneCard[];
  readonly frontId: number | null;
  readonly laneWidth: number;
}

/** The lane: a red edge at the left, the cards sliding toward it. */
export function ChipRushLane({ cards, frontId, laneWidth }: ChipRushLaneProps) {
  return (
    <View style={styles.lane}>
      <View style={styles.edge} />
      {laneWidth > 0
        ? cards.map((card) => (
            <LaneCardView key={card.id} card={card} laneWidth={laneWidth} front={card.id === frontId} />
          ))
        : null}
    </View>
  );
}

/** Chip colours per bet size, 1 to 8 units. */
const STACK_COLORS: readonly string[] = [
  '#F3ECD9',
  '#E6862A',
  '#3576C9',
  '#3E9A4E',
  '#C9342E',
  '#7A4FB8',
  '#2B2B2B',
  '#F2C445',
];

interface StackProps {
  readonly units: number;
  readonly disabled: boolean;
  readonly onBet: (units: number) => void;
}

/** One draggable stack: drag it up onto the bet circle, or tap it. */
function ChipStackButton({ units, disabled, onBet }: StackProps) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(6)
    .onBegin(() => {
      lifted.value = withTiming(1, { duration: 80 });
    })
    .onUpdate((event) => {
      dx.value = event.translationX;
      dy.value = event.translationY;
    })
    .onEnd((event) => {
      // Dropped well above the tray: onto the circle.
      if (event.translationY < -40) {
        runOnJS(onBet)(units);
      }
    })
    .onFinalize(() => {
      dx.value = withSpring(0, { damping: 18, stiffness: 260 });
      dy.value = withSpring(0, { damping: 18, stiffness: 260 });
      lifted.value = withTiming(0, { duration: 120 });
    });
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd(() => {
      runOnJS(onBet)(units);
    });

  const style = useAnimatedStyle(() => ({
    zIndex: lifted.value > 0 ? 10 : 1,
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: 1 + lifted.value * 0.1 }],
  }));
  const color = STACK_COLORS[units - 1];
  const dark = units >= 3 && units !== 8;

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        style={[styles.stack, style, disabled && styles.stackDisabled]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Bet ${units} unit${units === 1 ? '' : 's'}`}
      >
        <View style={[styles.chip, styles.chipShadow, { backgroundColor: color }]} />
        <View style={[styles.chip, styles.chipMid, { backgroundColor: color }]} />
        <View style={[styles.chip, styles.chipTop, { backgroundColor: color }]}>
          <Text style={[styles.chipText, { color: dark ? colors.arcadeCream : colors.arcadeInk }]}>{units}u</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

interface ChipTrayProps {
  readonly disabled: boolean;
  readonly onBet: (units: number) => void;
}

/** The tray: stacks for 1 to 8 units, two rows of four. */
export function ChipRushTray({ disabled, onBet }: ChipTrayProps) {
  return (
    <View style={styles.tray}>
      {CHIP_RUSH_STACKS.map((units) => (
        <ChipStackButton key={units} units={units} disabled={disabled} onBet={onBet} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lane: {
    height: 128,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(201,151,31,0.6)',
    overflow: 'hidden',
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
    backgroundColor: '#E0524D',
  },
  card: {
    position: 'absolute',
    left: 0,
    top: 14,
    width: LANE_CARD_WIDTH,
    height: 96,
    borderRadius: 10,
    backgroundColor: colors.arcadeCream,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFront: {
    borderColor: colors.arcadeMint,
    borderWidth: 4,
  },
  cardKicker: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.arcadeInk,
  },
  cardValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.arcadeInk,
    includeFontPadding: false,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 12,
  },
  stack: {
    width: '23%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stackDisabled: {
    opacity: 0.5,
  },
  chip: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.arcadeCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipShadow: {
    bottom: 0,
    opacity: 0.55,
  },
  chipMid: {
    bottom: 4,
    opacity: 0.8,
  },
  chipTop: {
    bottom: 8,
  },
  chipText: {
    fontFamily: fonts.display,
    fontSize: 20,
    includeFontPadding: false,
  },
});
