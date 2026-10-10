import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { FLIP_MAX, FLIP_MIN, sliderFraction } from '../../engine/dojo';
import { PlayerAction } from '../../engine/blackjack/rules';
import { colors, fontWeights } from '../../theme';
import { formatCount } from '../../utils/countCoach';

const KNOB = 40;
const TRACK_HEIGHT = 6;
const TICKS = Array.from({ length: FLIP_MAX - FLIP_MIN + 1 }, (_, i) => FLIP_MIN + i);

interface FlipPointSliderProps {
  /** Bumps with every new hand: the knob goes back to −5. */
  readonly serial: number;
  /** When the sweep started; null when the knob is not moving. */
  readonly sweepStartedAt: number | null;
  readonly sweepMs: number;
  /** Where the player stopped it (null: no stop yet, or the sweep ran out). */
  readonly stopValue: number | null;
  /** Show the answer: the two zones and the flip mark. */
  readonly revealed: boolean;
  /** The play's index — where the flip is. */
  readonly index: number;
  readonly below: PlayerAction;
  readonly action: PlayerAction;
}

/**
 * The count slider: ticks from −5 to +5 (0 picked out), a knob that sweeps
 * left to right on the UI thread from the store's start time, and — once the
 * hand is decided — the two plays either side of the flip.
 */
export function FlipPointSlider({
  serial,
  sweepStartedAt,
  sweepMs,
  stopValue,
  revealed,
  index,
  below,
  action,
}: FlipPointSliderProps) {
  const [width, setWidth] = useState(0);
  const knob = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(knob);
    if (sweepStartedAt !== null) {
      const elapsed = Math.max(0, Date.now() - sweepStartedAt);
      knob.value = Math.min(1, elapsed / sweepMs);
      knob.value = withTiming(1, { duration: Math.max(0, sweepMs - elapsed), easing: Easing.linear });
      return;
    }
    if (stopValue !== null) {
      knob.value = sliderFraction(stopValue);
    } else if (revealed) {
      // The sweep ran out: the knob sits at the far end.
      knob.value = 1;
    } else {
      knob.value = 0;
    }
  }, [serial, sweepStartedAt, sweepMs, stopValue, revealed, knob]);

  const knobStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: knob.value * width - KNOB / 2 }] }),
    [width],
  );

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const flip = sliderFraction(index);

  return (
    <View style={styles.block} accessibilityLabel="Count slider from minus five to plus five">
      <View style={styles.zones}>
        {revealed ? (
          <>
            <View style={[styles.zone, styles.zoneBelow, { flex: Math.max(0.001, flip) }]}>
              <Text style={styles.zoneText} numberOfLines={1}>
                {below.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.zone, styles.zoneAbove, { flex: Math.max(0.001, 1 - flip) }]}>
              <Text style={styles.zoneText} numberOfLines={1}>
                {action.toUpperCase()}
              </Text>
            </View>
          </>
        ) : (
          <View style={[styles.zone, styles.zoneHidden]}>
            <Text style={styles.zoneHiddenText}>WHERE DOES THE PLAY CHANGE?</Text>
          </View>
        )}
      </View>
      <View style={styles.track} onLayout={onLayout}>
        <View style={styles.line} />
        {TICKS.map((tick) => (
          <View
            key={tick}
            style={[
              styles.tick,
              tick === 0 && styles.tickZero,
              { left: `${sliderFraction(tick) * 100}%` },
            ]}
          />
        ))}
        {revealed ? <View style={[styles.flipMark, { left: `${flip * 100}%` }]} /> : null}
        {width > 0 ? (
          <Animated.View style={[styles.knob, knobStyle]}>
            <Text style={styles.knobText} numberOfLines={1}>
              {stopValue !== null ? formatCount(Math.round(stopValue * 10) / 10) : ''}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.numbers}>
        {TICKS.map((tick) => (
          <Text key={tick} style={[styles.number, tick === 0 && styles.numberZero]}>
            {formatCount(tick)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'stretch',
    gap: 6,
  },
  zones: {
    flexDirection: 'row',
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.arcadeInk,
  },
  zone: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBelow: {
    backgroundColor: '#2F7D3E',
  },
  zoneAbove: {
    backgroundColor: '#A82A25',
  },
  zoneHidden: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  zoneText: {
    color: colors.arcadeCream,
    fontSize: 11,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  zoneHiddenText: {
    color: colors.arcadeMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  track: {
    height: KNOB + 12,
    marginHorizontal: KNOB / 2,
    justifyContent: 'center',
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#C9BC9C',
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: 16,
    marginLeft: -1,
    backgroundColor: '#C9BC9C',
  },
  tickZero: {
    height: 24,
    backgroundColor: colors.arcadeGold,
  },
  flipMark: {
    position: 'absolute',
    width: 4,
    height: KNOB + 8,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: colors.arcadeMint,
  },
  knob: {
    position: 'absolute',
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.arcadeGold,
    borderWidth: 3,
    borderColor: colors.arcadeInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobText: {
    color: colors.arcadeInk,
    fontSize: 11,
    fontWeight: fontWeights.bold,
  },
  numbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: KNOB / 2 - 10,
  },
  number: {
    width: 20,
    textAlign: 'center',
    color: '#CBB88F',
    fontSize: 10,
  },
  numberZero: {
    color: colors.arcadeGold,
    fontWeight: fontWeights.bold,
  },
});
