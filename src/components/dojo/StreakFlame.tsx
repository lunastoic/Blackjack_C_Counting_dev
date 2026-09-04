import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';

interface StreakFlameProps {
  readonly streak: number;
  readonly label?: string;
}

export function StreakFlame({ streak, label = 'Streak' }: StreakFlameProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (reducedMotion || streak <= 0) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      ),
      -1,
      true,
    );
  }, [streak, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.root}>
      <Animated.Text style={[styles.flame, animatedStyle]}>🔥</Animated.Text>
      <View style={styles.text}>
        <Text style={styles.count}>{streak}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flame: {
    fontSize: fontSizes.title,
  },
  text: {
    alignItems: 'flex-start',
  },
  count: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
});
