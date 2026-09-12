import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInLeft, FadeOutLeft } from 'react-native-reanimated';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fonts, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { BetAdvice, BetAdviceTone } from '../../utils/countCoach';

/** The pointer's reach from the pill's edge to the rail's value tag. */
const POINTER = 7;
const CALLOUT_WIDTH = 176;

const TONE_COLORS: Record<BetAdviceTone, string> = {
  cold: colors.trainingMinus,
  flat: colors.gold,
  hot: colors.trainingPlus,
};

const MODERN_TONE_COLORS: Record<BetAdviceTone, string> = {
  cold: colors.arcadeLoss,
  flat: colors.arcadeGold,
  hot: colors.arcadeMint,
};

const TONE_ICONS: Record<BetAdviceTone, React.ComponentProps<typeof Ionicons>['name']> = {
  cold: 'snow-outline',
  flat: 'remove-circle-outline',
  hot: 'flame-outline',
};

interface BetCalloutProps {
  readonly advice: BetAdvice;
  /** Where the pointer's tip goes, in the parent's coordinates. */
  readonly left: number;
  readonly centerY: number;
}

/**
 * The coach's bet tip: a small plaque hung off the count rail's indicator
 * with a pointer at the value tag — "Count is −6 / Cold shoe — keep it at
 * the minimum." It rides with the indicator, so it sits wherever the count
 * has the tag. Never takes input; the tone colour matches the rail.
 *
 * Absolutely positioned and centred on `centerY` by its measured height: laid
 * out in the indicator's fixed-height row it would be measured against that
 * height and lose its second line.
 */
export function BetCallout({ advice, left, centerY }: BetCalloutProps) {
  const reducedMotion = useReducedMotion();
  const modern = useModernUi();
  const [height, setHeight] = useState(0);
  const tint = modern ? MODERN_TONE_COLORS[advice.tone] : TONE_COLORS[advice.tone];

  function onLayout(event: LayoutChangeEvent) {
    setHeight(event.nativeEvent.layout.height);
  }

  return (
    <Animated.View
      key={advice.tone}
      style={[styles.slot, { left, top: centerY - height / 2 }]}
      onLayout={onLayout}
      entering={reducedMotion ? undefined : FadeInLeft.duration(220)}
      exiting={reducedMotion ? undefined : FadeOutLeft.duration(160)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${advice.headline}. ${advice.detail}`}
    >
      <View style={[styles.pointer, { borderRightColor: modern ? colors.arcadeInk : tint }]} />
      <View
        style={[
          styles.plaque,
          modern ? styles.plaqueModern : { borderColor: tint },
        ]}
      >
        <View style={styles.headlineRow}>
          <Ionicons name={TONE_ICONS[advice.tone]} size={12} color={tint} />
          <Text
            style={[styles.headline, modern && styles.headlineModern, { color: tint }]}
            numberOfLines={1}
          >
            {advice.headline}
          </Text>
        </View>
        <Text style={[styles.detail, modern && styles.detailModern]}>{advice.detail}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** A triangle drawn with borders, pointing left at the value tag. */
  pointer: {
    width: 0,
    height: 0,
    borderTopWidth: POINTER,
    borderBottomWidth: POINTER,
    borderRightWidth: POINTER,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  plaque: {
    width: CALLOUT_WIDTH,
    gap: 2,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xs + spacing.xxs,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: colors.backgroundElevated,
    ...shadows.raised,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headline: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.caption + 4,
  },
  /* Modern */
  plaqueModern: {
    backgroundColor: colors.arcadeToastFill,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    borderRadius: 14,
    shadowColor: colors.arcadeInk,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
  },
  headlineModern: {
    fontFamily: fonts.display,
    fontWeight: undefined,
    fontSize: 18,
    lineHeight: 19,
    letterSpacing: 1,
    includeFontPadding: false,
  },
  detailModern: {
    fontFamily: fonts.mono,
    fontWeight: undefined,
    color: colors.arcadeMuted,
    fontSize: 11,
    lineHeight: 15,
  },
});
