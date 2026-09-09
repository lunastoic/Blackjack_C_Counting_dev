import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { StarBank } from '../../stores/trainingStore';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';

/** How long a banked star hangs over the felt. */
const TOAST_MS = 2000;

interface StarBankToastProps {
  readonly bank: StarBank | null;
}

/**
 * A star banked mid-run: a pill over the felt with the stars so far and the
 * chips it paid, gone again in a beat. The run itself never pauses for it,
 * and the answer that banked it already rang the chime.
 */
export function StarBankToast({ bank }: StarBankToastProps) {
  const reducedMotion = useReducedMotion();
  /** Serial of the bank whose beat has passed. */
  const [expired, setExpired] = useState<number | null>(null);

  useEffect(() => {
    if (!bank) {
      return;
    }
    const timer = setTimeout(() => setExpired(bank.serial), TOAST_MS);
    return () => clearTimeout(timer);
  }, [bank]);

  const shown = bank && bank.serial !== expired ? bank : null;
  if (!shown) {
    return null;
  }
  return (
    <View style={styles.slot} pointerEvents="none">
      <Animated.View
        key={shown.serial}
        style={styles.pill}
        entering={reducedMotion ? undefined : FadeInDown.duration(220)}
        exiting={reducedMotion ? undefined : FadeOutUp.duration(200)}
        accessibilityLabel={`${shown.stars} of 3 stars banked${shown.chips > 0 ? `, ${shown.chips} chips` : ''}`}
      >
        <View style={styles.stars}>
          {[0, 1, 2].map((index) => (
            <Ionicons
              key={index}
              name={index < shown.stars ? 'star' : 'star-outline'}
              size={16}
              color={index < shown.stars ? colors.goldBright : colors.textMuted}
            />
          ))}
        </View>
        <Text style={styles.text}>
          {shown.chips > 0 ? `Star banked · +${formatChips(shown.chips)} chips` : 'Star banked'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...shadows.overlay,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  text: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
});
