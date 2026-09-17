import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { comboMultiplier } from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

/** How long "New best" hangs over the felt. */
const BEST_MS = 2200;

interface ComboCalloutProps {
  readonly combo: number;
  /** Bumps when the multiplier steps up — the pill pops again. */
  readonly serial: number;
  /** Bumps when a run goes past the level's best (0: not this run). */
  readonly bestSerial: number;
}

/**
 * Over the felt, above the question: the live combo once it pays (×2 and up),
 * popping each time the multiplier climbs, and a short "New best" the moment
 * the run passes the level's record. Neither pauses the run.
 */
export function ComboCallout({ combo, serial, bestSerial }: ComboCalloutProps) {
  const reducedMotion = useReducedMotion();
  const multiplier = comboMultiplier(combo);
  /** Serial of the "New best" whose beat has passed. */
  const [expired, setExpired] = useState(0);

  useEffect(() => {
    if (bestSerial === 0) {
      return;
    }
    const timer = setTimeout(() => setExpired(bestSerial), BEST_MS);
    return () => clearTimeout(timer);
  }, [bestSerial]);

  const bestShown = bestSerial !== 0 && bestSerial !== expired;

  if (multiplier < 2 && !bestShown) {
    return null;
  }
  return (
    <View style={styles.slot} pointerEvents="none">
      {bestShown ? (
        <Animated.View
          style={[styles.pill, styles.best]}
          entering={reducedMotion ? undefined : FadeInDown.duration(220)}
          exiting={reducedMotion ? undefined : FadeOut.duration(200)}
          accessibilityLabel="New personal best"
        >
          <Ionicons name="trophy" size={14} color={colors.goldBright} />
          <Text style={styles.bestText}>New best</Text>
        </Animated.View>
      ) : null}
      {multiplier >= 2 ? (
        <Animated.View
          key={serial}
          style={[styles.pill, multiplier >= 4 && styles.hot]}
          entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)}
          accessibilityLabel={`Combo times ${multiplier}, ${combo} fast in a row`}
        >
          <Ionicons name="flame" size={14} color={multiplier >= 4 ? colors.error : colors.goldBright} />
          <Text style={styles.multiplier}>×{multiplier}</Text>
          <Text style={styles.count}>{combo} in a row</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    top: -spacing.xl - spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    zIndex: 30,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...shadows.overlay,
  },
  hot: {
    borderColor: colors.error,
  },
  best: {
    borderColor: colors.goldBright,
  },
  multiplier: {
    color: colors.goldBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  count: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
  bestText: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
});
