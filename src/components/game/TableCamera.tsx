import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
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

const SIT_EASING = Easing.bezier(0.22, 1, 0.36, 1);

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
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(seated ? SEATED.scale : STANDING.scale);

  useEffect(() => {
    const next = seated ? SEATED.scale : STANDING.scale;
    if (reducedMotion) {
      scale.value = next;
      return;
    }
    scale.value = withTiming(next, {
      duration: durations.tableSit,
      easing: SIT_EASING,
    });
  }, [seated, reducedMotion, scale]);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
