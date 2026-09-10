import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { durations } from '../../theme';

/**
 * Standing (betting): slight pull-back — content stays fully inside the frame.
 * Seated (after Deal): ease to the natural layout (scale 1, no shift) so
 * dealer, count rail, stats, and player hand are never clipped.
 */
const STANDING = { scale: 0.94, translateY: 0 } as const;
const SEATED = { scale: 1, translateY: 0 } as const;

/**
 * The felt is the one thing that must fill the screen while standing, so it
 * zooms the other way: by the time the play content reaches 1× the felt has
 * grown by the same ratio, and the whole table reads as one surface coming
 * closer. A touch of downward drift sells the eye line dropping into a seat.
 */
export const FELT_SIT_SCALE = SEATED.scale / STANDING.scale;
export const FELT_SIT_DROP = 10;

const SIT_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * 0 while standing, 1 once seated, easing between the two over the sit
 * duration (or snapping, with reduced motion). Every layer of the table
 * animates off this one curve so the felt, its lettering and the cards move
 * as a single camera.
 */
export function useSeatedProgress(seated: boolean): SharedValue<number> {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(seated ? 1 : 0);

  useEffect(() => {
    const next = seated ? 1 : 0;
    if (reducedMotion) {
      progress.value = next;
      return;
    }
    progress.value = withTiming(next, {
      duration: durations.tableSit,
      easing: SIT_EASING,
    });
  }, [seated, reducedMotion, progress]);

  return progress;
}

interface TableCameraProps {
  /** True once Deal is pressed / while a round is live. */
  readonly seated: boolean;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Faux camera for the felt playfield: on Deal, eases from a gentle pull-back
 * into the seated frame. Never scales past 1 or shifts Y, so nothing is cut off.
 */
export function TableCamera({ seated, children, style }: TableCameraProps) {
  const progress = useSeatedProgress(seated);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: STANDING.scale + (SEATED.scale - STANDING.scale) * progress.value },
      { translateY: STANDING.translateY + (SEATED.translateY - STANDING.translateY) * progress.value },
    ],
  }));

  return (
    <View style={[styles.viewport, style]}>
      <Animated.View style={[styles.stage, cameraStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  stage: {
    flex: 1,
    minHeight: 0,
  },
});
