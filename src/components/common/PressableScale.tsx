import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { durations } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { haptics } from '../../services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  readonly style?: StyleProp<ViewStyle>;
  /** Fires a light haptic tap on press (default true). */
  readonly hapticFeedback?: boolean;
  readonly children?: React.ReactNode;
}

/**
 * Base tactile control: scales down slightly while pressed (opacity dip when
 * reduced motion is on) and routes haptic feedback through the service.
 */
export function PressableScale({
  style,
  hapticFeedback = true,
  onPressIn,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return { opacity: 1 - pressed.value * 0.3 };
    }
    return {
      transform: [{ scale: 1 - pressed.value * 0.04 }],
      opacity: 1 - pressed.value * 0.1,
    };
  });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      style={[animatedStyle, style]}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: durations.fast });
        onPressIn?.(event);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: durations.fast });
      }}
      onPress={(event) => {
        if (hapticFeedback) {
          void haptics.lightTap();
        }
        onPress?.(event);
      }}
      {...rest}
    />
  );
}
