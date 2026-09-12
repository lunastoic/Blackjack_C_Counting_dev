import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { haptics } from '../../services/haptics';
import { colors, durations, fonts, radii, spacing } from '../../theme';

/** How far the face sits proud of its ink base — the "3D" of the bevel. */
export const ARCADE_BUTTON_DEPTH = 6;
const OUTLINE = 3;
/** The deeper band along the face's bottom, inside the outline. */
const BAND = 6;

export type ArcadeButtonVariant = 'gold' | 'green' | 'red' | 'orange' | 'blue' | 'neutral';
export type ArcadeButtonSize = 'small' | 'medium' | 'large';

interface Palette {
  readonly face: string;
  readonly deep: string;
  readonly label: string;
}

const PALETTES: Readonly<Record<ArcadeButtonVariant, Palette>> = {
  gold: { face: colors.arcadeGold, deep: colors.arcadeGoldDeep, label: colors.arcadeInkOnLight },
  green: { face: colors.arcadeGreen, deep: colors.arcadeGreenDeep, label: colors.arcadeCream },
  red: { face: colors.arcadeRed, deep: colors.arcadeRedDeep, label: colors.arcadeCream },
  orange: { face: colors.arcadeOrange, deep: colors.arcadeOrangeDeep, label: colors.arcadeCream },
  blue: { face: colors.arcadeBlue, deep: colors.arcadeBlueDeep, label: colors.arcadeCream },
  neutral: {
    face: colors.arcadeNeutral,
    deep: colors.arcadeNeutralDeep,
    label: colors.arcadeCream,
  },
};

const SIZES: Readonly<
  Record<ArcadeButtonSize, { fontSize: number; minHeight: number; paddingH: number; radius: number }>
> = {
  small: { fontSize: 22, minHeight: 40, paddingH: spacing.sm, radius: radii.sm + 2 },
  medium: { fontSize: 26, minHeight: 46, paddingH: spacing.lg, radius: radii.md },
  large: { fontSize: 32, minHeight: 54, paddingH: spacing.xl, radius: radii.lg },
};

export interface ArcadeButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ArcadeButtonVariant;
  readonly size?: ArcadeButtonSize;
  readonly disabled?: boolean;
  /**
   * Fade the button while disabled (default true). Off for answer pads, whose
   * colour after the reveal is the feedback.
   */
  readonly dimDisabled?: boolean;
  /** A glyph after the label, e.g. ▶ on Start. */
  readonly trailing?: string;
  /** Fires the light tap on press (default true). */
  readonly hapticFeedback?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The Modern look's button: a flat face with a thick ink outline sitting on
 * an ink base, a deeper band along its bottom edge, and the pixel face for
 * the label. Pressing drops the face onto the base. Drawn entirely in code —
 * no PNGs — so any colour is a variant away.
 */
export function ArcadeButton({
  label,
  onPress,
  variant = 'gold',
  size = 'medium',
  disabled = false,
  dimDisabled = true,
  trailing,
  hapticFeedback = true,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ArcadeButtonProps) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const palette = PALETTES[variant];
  const metrics = SIZES[size];

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * ARCADE_BUTTON_DEPTH }],
  }));

  // The caller's style goes on a wrapper: padding or flex there never pulls
  // the ink base out from under the face.
  return (
    <View style={[style, disabled && dimDisabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          pressed.value = reducedMotion ? 1 : withTiming(1, { duration: durations.fast });
        }}
        onPressOut={() => {
          pressed.value = reducedMotion ? 0 : withTiming(0, { duration: durations.fast });
        }}
        onPress={() => {
          if (hapticFeedback) {
            void haptics.lightTap();
          }
          onPress();
        }}
        style={styles.root}
      >
        <View style={[styles.base, { borderRadius: metrics.radius }]} />
        <Animated.View
          style={[
            styles.face,
            {
              backgroundColor: palette.face,
              borderRadius: metrics.radius,
              minHeight: metrics.minHeight,
              paddingHorizontal: metrics.paddingH,
            },
            faceStyle,
          ]}
        >
          <View style={[styles.band, { backgroundColor: palette.deep }]} />
          <Text
            style={[styles.label, { color: palette.label, fontSize: metrics.fontSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {label.toUpperCase()}
            {trailing ? ` ${trailing}` : ''}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    paddingBottom: ARCADE_BUTTON_DEPTH,
  },
  disabled: {
    opacity: 0.4,
  },
  /** The ink block the face rests on; only its bottom edge ever shows. */
  base: {
    position: 'absolute',
    top: ARCADE_BUTTON_DEPTH,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.arcadeInk,
  },
  face: {
    borderWidth: OUTLINE,
    borderColor: colors.arcadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs + BAND / 2,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAND,
  },
  label: {
    fontFamily: fonts.display,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
});
