import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, durations, fontSizes, fontWeights, radii, spacing } from '../../theme';

interface TipToastProps {
  readonly message: string;
  readonly variant?: 'info' | 'warning' | 'success';
  readonly onDismiss?: () => void;
  readonly autoDismissMs?: number;
}

export function TipToast({
  message,
  variant = 'info',
  onDismiss,
  autoDismissMs = 4000,
}: TipToastProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: durations.normal });
    if (onDismiss && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        opacity.value = reducedMotion ? 0 : withTiming(0, { duration: durations.normal });
        setTimeout(onDismiss, reducedMotion ? 0 : durations.normal);
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [message, autoDismissMs, onDismiss, opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const variantColor =
    variant === 'success'
      ? colors.success
      : variant === 'warning'
        ? colors.warning
        : colors.gold;

  return (
    <Animated.View style={[styles.root, { borderColor: variantColor }, animatedStyle]}>
      <Text style={[styles.badge, { color: variantColor }]}>
        {variant === 'success' ? 'NICE' : variant === 'warning' ? 'TIP' : 'NOTE'}
      </Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  badge: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  message: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    lineHeight: 20,
  },
});
