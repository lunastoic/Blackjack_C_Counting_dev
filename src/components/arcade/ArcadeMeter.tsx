import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, durations } from '../../theme';
import { ArcadeBevel } from './ArcadeChrome';

/**
 * The Modern look's meters: the ink-outlined training rail that fills from
 * red to green, and the plain gold bar behind the level number. Both sit on
 * an ink drop like every other piece of chrome.
 */

/** The rail's colours, empty end to full end. */
export const ARCADE_RAIL = [
  colors.meterLow,
  colors.meterMid,
  colors.meterHigh,
  colors.meterFull,
] as const;
const RAIL_STOPS = [0, 0.4, 0.68, 1] as const;

function useAnimatedProgress(progress: number) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const animated = useSharedValue(clamped);
  useEffect(() => {
    animated.value = reducedMotion ? clamped : withTiming(clamped, { duration: durations.slow });
  }, [animated, clamped, reducedMotion]);
  return { animated, clamped };
}

interface ArcadeMeterProps {
  /** 0..1 */
  readonly progress: number;
  /** Checkpoint ticks, as fractions of the track. */
  readonly ticks?: readonly number[];
  readonly height?: number;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** The training meter: a faint full rail under a fill that lights up as far as the streak goes. */
export function ArcadeMeter({
  progress,
  ticks = [],
  height = 16,
  accessibilityLabel,
  style,
}: ArcadeMeterProps) {
  const { animated, clamped } = useAnimatedProgress(progress);
  const [trackWidth, setTrackWidth] = useState(0);
  const fillStyle = useAnimatedStyle(() => ({ width: animated.value * trackWidth }));
  const headStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, animated.value * trackWidth - 2) }],
    opacity: animated.value > 0 ? 1 : 0,
  }));
  const inner = height - 4;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={style}
    >
      <ArcadeBevel
        face={colors.overlay}
        deep={colors.overlay}
        drop={3}
        outline={2}
        band={0}
        radius={height / 2}
        faceStyle={{ height }}
      >
        <View
          style={styles.track}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        >
          <LinearGradient
            colors={[...ARCADE_RAIL]}
            locations={[...RAIL_STOPS]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, styles.ghost]}
          />
          <Animated.View style={[styles.fill, fillStyle]}>
            <LinearGradient
              colors={[...ARCADE_RAIL]}
              locations={[...RAIL_STOPS]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ width: trackWidth, height: inner }}
            />
            <View style={[styles.sheen, { height: inner * 0.4 }]} />
            <View style={[styles.shade, { height: inner * 0.25 }]} />
          </Animated.View>
          {ticks.map((tick) => (
            <View key={tick} style={[styles.tick, { left: `${tick * 100}%` }]} />
          ))}
          <Animated.View style={[styles.head, headStyle]} />
        </View>
      </ArcadeBevel>
    </View>
  );
}

interface ArcadeBarProps {
  readonly progress: number;
  /** The level bar is 14; the locked table's foot runs 6 with a hairline outline. */
  readonly thin?: boolean;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** A gold progress bar on the ink outline — the HUD level bar and the locked table's foot. */
export function ArcadeBar({ progress, thin = false, accessibilityLabel, style }: ArcadeBarProps) {
  const { animated, clamped } = useAnimatedProgress(progress);
  const fillStyle = useAnimatedStyle(() => ({ width: `${animated.value * 100}%` }));
  const height = thin ? 6 : 14;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={style}
    >
      <ArcadeBevel
        face={colors.overlay}
        deep={colors.overlay}
        drop={thin ? 0 : 3}
        outline={thin ? 1 : 2}
        band={0}
        radius={height / 2}
        faceStyle={{ height }}
      >
        <Animated.View style={[styles.barFill, fillStyle]}>
          {thin ? null : <View style={styles.barBand} />}
        </Animated.View>
      </ArcadeBevel>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  ghost: {
    opacity: 0.16,
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.arcadeHighlight,
  },
  shade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.chipShadow,
    opacity: 0.45,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.arcadeInk,
    opacity: 0.6,
  },
  head: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 0,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.arcadeCream,
    shadowColor: colors.arcadeCream,
    shadowOpacity: 0.9,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.arcadeGold,
    overflow: 'hidden',
  },
  barBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.arcadeGoldDeep,
  },
});
