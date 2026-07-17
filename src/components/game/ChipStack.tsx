import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CHIP_SETS } from '../../assets/registry';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights } from '../../theme';
import { decomposeChips } from '../../utils/chips';
import { formatChips } from '../../utils/format';

/** Deterministic sideways jitter so piles look hand-placed, not machine-stacked. */
const X_JITTER = [0, 1.5, -1.5, 1, -1, 2, -2, 0.5, -0.5, 1.5];

interface ChipStackProps {
  readonly amount: number;
  readonly chipSetKey: string;
  readonly chipSize?: number;
  readonly showLabel?: boolean;
  /** Animate chips dropping onto the pile as the amount grows. */
  readonly animateIn?: boolean;
}

/**
 * A physical pile of casino chips representing an amount, built from the
 * active map's themed chip art. Chips stack upward with a slight offset like
 * a real table stack.
 */
export function ChipStack({
  amount,
  chipSetKey,
  chipSize = 40,
  showLabel = true,
  animateIn = true,
}: ChipStackProps) {
  const reducedMotion = useReducedMotion();
  const chipSet = CHIP_SETS[chipSetKey] ?? CHIP_SETS.default;
  const denominations = useMemo(
    () => Object.keys(chipSet).map(Number).filter((v) => Number.isFinite(v)),
    [chipSet],
  );
  const chips = useMemo(
    () => decomposeChips(amount, denominations),
    [amount, denominations],
  );

  if (chips.length === 0) {
    return null;
  }

  const rise = Math.round(chipSize * 0.22);
  const stackHeight = chipSize + (chips.length - 1) * rise;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={{ width: chipSize + 6, height: stackHeight }}>
        {chips.map((value, index) => (
          <Animated.View
            // Re-keying by position keeps existing chips still while newly
            // added ones drop in on top.
            key={`${index}-${value}`}
            entering={
              animateIn && !reducedMotion
                ? FadeInDown.duration(180).delay(index * 30)
                : undefined
            }
            style={{
              position: 'absolute',
              bottom: index * rise,
              left: 3 + (X_JITTER[index % X_JITTER.length] ?? 0),
              zIndex: index,
            }}
          >
            <Image
              source={chipSet[value]}
              style={{ width: chipSize, height: chipSize }}
              resizeMode="contain"
            />
          </Animated.View>
        ))}
      </View>
      {showLabel ? <Text style={styles.label}>{formatChips(amount)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowRadius: 3,
  },
});
