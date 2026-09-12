import { Ionicons } from '@expo/vector-icons';
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

export type ArcadeButtonVariant =
  | 'gold'
  | 'green'
  | 'red'
  | 'orange'
  | 'blue'
  | 'neutral'
  | 'locked';
export type ArcadeButtonSize = 'xsmall' | 'small' | 'medium' | 'large';

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
  /** A dimmed neutral for a control that is locked rather than merely disabled. */
  locked: { face: colors.arcadeLocked, deep: colors.arcadeLockedDeep, label: colors.arcadeMuted },
};

const SIZES: Readonly<
  Record<ArcadeButtonSize, { fontSize: number; minHeight: number; paddingH: number; radius: number }>
> = {
  xsmall: { fontSize: 20, minHeight: 38, paddingH: spacing.md + spacing.xxs, radius: radii.sm + 2 },
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
  /** A glyph after the label — "▶" draws the play icon (the pixel face has no such glyph). */
  readonly trailing?: string;
  /** A glyph or icon before the label — "▶" on Play Table, the lock on a locked one, a tab's icon. */
  readonly leading?: React.ReactNode;
  /** A smaller line under the label — "max bet 1,000" under Play Table. */
  readonly sublabel?: string;
  /** The strategy glow: the book move lights up while a hint is showing. */
  readonly glow?: boolean;
  /** A circle instead of a rounded block — the −/+ steppers. */
  readonly round?: boolean;
  /** Anything laid over the face — the progress bar along a locked table's foot. */
  readonly overlay?: React.ReactNode;
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
  leading,
  sublabel,
  glow = false,
  round = false,
  overlay,
  hapticFeedback = true,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ArcadeButtonProps) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const palette = PALETTES[variant];
  const metrics = SIZES[size];
  const radius = round ? metrics.minHeight : metrics.radius;

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * ARCADE_BUTTON_DEPTH }],
  }));

  // The caller's style goes on a wrapper: padding or flex there never pulls
  // the ink base out from under the face.
  return (
    <View style={[style, disabled && dimDisabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (sublabel ? `${label}, ${sublabel}` : label)}
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
        style={[styles.root, round && { width: metrics.minHeight }]}
      >
        {glow ? <View style={[styles.glow, { borderRadius: radius + 2 }]} /> : null}
        <View style={[styles.base, { borderRadius: radius }]} />
        <Animated.View
          style={[
            styles.face,
            {
              backgroundColor: palette.face,
              borderRadius: radius,
              minHeight: metrics.minHeight,
              paddingHorizontal: round ? 0 : metrics.paddingH,
            },
            round && { width: metrics.minHeight, height: metrics.minHeight },
            faceStyle,
          ]}
        >
          <View style={[styles.band, { backgroundColor: palette.deep }]} />
          <View style={styles.row}>
            {leading ? (
              <View style={styles.leading}>
                {leading === PLAY ? <PlayGlyph color={palette.label} fontSize={metrics.fontSize} /> : leading}
              </View>
            ) : null}
            <Text
              style={[
                styles.label,
                { color: palette.label, fontSize: metrics.fontSize },
                variant === 'gold' && styles.labelOnLight,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {label.toUpperCase()}
              {trailing && trailing !== PLAY ? ` ${trailing}` : ''}
            </Text>
            {trailing === PLAY ? <PlayGlyph color={palette.label} fontSize={metrics.fontSize} /> : null}
          </View>
          {sublabel ? (
            <Text
              style={[styles.sublabel, { color: palette.label }, variant === 'gold' && styles.labelOnLight]}
              numberOfLines={1}
            >
              {sublabel.toUpperCase()}
            </Text>
          ) : null}
          {overlay}
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** The play arrow: Jersey has no ▶, and the system fallback draws an emoji. */
const PLAY = '▶';
function PlayGlyph({ color, fontSize }: { color: string; fontSize: number }) {
  return <Ionicons name="play" size={Math.round(fontSize * 0.62)} color={color} style={styles.play} />;
}

const styles = StyleSheet.create({
  play: {
    marginTop: 1,
  },
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
  /** The strategy hint: a soft yellow halo around the whole bevel. */
  glow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    backgroundColor: colors.strategyHint,
    opacity: 0.9,
    shadowColor: colors.strategyHint,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
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
  // The row stays inside the face so a long label shrinks (adjustsFontSizeToFit)
  // instead of pushing its leading glyph out past the edge.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    maxWidth: '100%',
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.display,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  labelOnLight: {
    textShadowColor: 'transparent',
  },
  sublabel: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 2,
    opacity: 0.8,
    textAlign: 'center',
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
    includeFontPadding: false,
    marginTop: 1,
  },
});
