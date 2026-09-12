import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { haptics } from '../../services/haptics';
import { colors, fonts, fontSizes, radii, spacing } from '../../theme';

/**
 * The Modern table's chrome — everything around the cards that is not a
 * button: the HUD squares and marquee, the count strip, the little plaque
 * tags, switches, badges and toasts. All of it is the same bevel as the
 * buttons (ink outline, flat face, deeper band, ink drop), drawn in code.
 */

/** Jersey text sitting on a bevel: the 1×2 ink drop under every label. */
export const arcadeShadow = StyleSheet.create({
  deep: {
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  soft: {
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
});

export interface ArcadeBevelProps {
  readonly face: string;
  readonly deep: string;
  /** How far the face sits proud of its ink base. */
  readonly drop: number;
  readonly outline: number;
  /** The deeper band inside the outline along the bottom (0 for none). */
  readonly band: number;
  readonly radius: number;
  readonly children?: React.ReactNode;
  /** The wrapper: size, margins and flex belong here. */
  readonly style?: StyleProp<ViewStyle>;
  /** The face: padding and content alignment. */
  readonly faceStyle?: StyleProp<ViewStyle>;
}

/** The bare bevel every other piece of chrome is built from. */
export function ArcadeBevel({
  face,
  deep,
  drop,
  outline,
  band,
  radius,
  children,
  style,
  faceStyle,
}: ArcadeBevelProps) {
  return (
    <View style={[{ paddingBottom: drop }, style]}>
      <View style={[styles.base, { top: drop, borderRadius: radius }]} />
      <View
        style={[
          styles.face,
          { borderWidth: outline, borderRadius: radius, backgroundColor: face },
          faceStyle,
        ]}
      >
        {band > 0 ? <View style={[styles.band, { height: band, backgroundColor: deep }]} /> : null}
        {children}
      </View>
    </View>
  );
}

export const ARCADE_SQUARE = 44;
const SQUARE_DROP = 4;

interface ArcadeSquareProps {
  readonly onPress: () => void;
  readonly children: React.ReactNode;
  /** Burgundy for the ≡ tab and the gear; neutral for the map and back squares. */
  readonly tone?: 'neutral' | 'plaque';
  /** The ≡ tab reads as the open dropdown: square top corners only. */
  readonly open?: boolean;
  readonly accessibilityLabel: string;
  readonly accessibilityState?: React.ComponentProps<typeof Pressable>['accessibilityState'];
  readonly style?: StyleProp<ViewStyle>;
}

/** A 44pt bevel square holding one icon — the HUD's corners. */
export function ArcadeSquare({
  onPress,
  children,
  tone = 'neutral',
  open = false,
  accessibilityLabel,
  accessibilityState,
  style,
}: ArcadeSquareProps) {
  const plaque = tone === 'plaque';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={() => {
        void haptics.lightTap();
        onPress();
      }}
      style={[styles.square, style]}
    >
      <ArcadeBevel
        face={plaque ? colors.arcadePlaque : colors.arcadeNeutral}
        deep={plaque ? colors.arcadePlaqueDeep : colors.arcadeNeutralDeep}
        drop={open ? 0 : SQUARE_DROP}
        outline={3}
        band={open ? 0 : SQUARE_DROP}
        radius={radii.md}
        faceStyle={[styles.squareFace, open && styles.squareFaceOpen]}
      >
        {children}
      </ArcadeBevel>
    </Pressable>
  );
}

interface ArcadeMarqueeProps {
  readonly title: string;
  readonly subtitle?: string;
  /** The map card's plaque runs its subtitle tighter. */
  readonly subtitleSpacing?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/** The burgundy marquee between the HUD squares: title over a gold subtitle. */
export function ArcadeMarquee({ title, subtitle, subtitleSpacing = 2, style }: ArcadeMarqueeProps) {
  return (
    <ArcadeBevel
      face={colors.arcadePlaque}
      deep={colors.arcadePlaqueDeep}
      drop={3}
      outline={3}
      band={4}
      radius={radii.md}
      style={style}
      faceStyle={styles.marqueeFace}
    >
      <Text style={styles.marqueeTitle} numberOfLines={1}>
        {title.toUpperCase()}
      </Text>
      {subtitle ? (
        <Text style={[styles.marqueeSub, { letterSpacing: subtitleSpacing }]} numberOfLines={1}>
          {subtitle.toUpperCase()}
        </Text>
      ) : null}
    </ArcadeBevel>
  );
}

interface ArcadeStripProps {
  readonly children: React.ReactNode;
  /** The table's count strip is a touch tighter than the quiz's. */
  readonly compact?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

/** The 50% black bevel strip: RUNNING · TRUE · CARDS LEFT, STREAK · RANK · FLASH. */
export function ArcadeStrip({ children, compact = false, style }: ArcadeStripProps) {
  return (
    <ArcadeBevel
      face={colors.arcadeStripFace}
      deep={colors.arcadeStripDeep}
      drop={5}
      outline={3}
      band={5}
      radius={14}
      style={style}
      faceStyle={[styles.stripFace, compact && styles.stripFaceCompact]}
    >
      {children}
    </ArcadeBevel>
  );
}

interface ArcadeStripCellProps {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly valueColor?: string;
  readonly compact?: boolean;
  readonly flex?: number;
  readonly valueStyle?: StyleProp<TextStyle>;
}

export function ArcadeStripCell({
  label,
  value,
  valueColor = colors.arcadeCream,
  compact = false,
  flex = 1,
  valueStyle,
}: ArcadeStripCellProps) {
  return (
    <View style={[styles.cell, { flex }]}>
      <Text style={[styles.cellLabel, compact && styles.cellLabelCompact]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={[styles.cellValue, compact && styles.cellValueCompact, { color: valueColor }, valueStyle]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export function ArcadeStripDivider() {
  return <View style={styles.divider} />;
}

interface ArcadeTagProps {
  readonly label: string;
  /** The dealer-speed and dial-in readouts run big. */
  readonly big?: boolean;
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** A small burgundy plaque with an ink outline — hand totals, the rail marker, readouts. */
export function ArcadeTag({ label, big = false, color = colors.arcadeGold, style }: ArcadeTagProps) {
  return (
    <ArcadeBevel
      face={colors.arcadePlaque}
      deep={colors.arcadePlaqueDeep}
      drop={3}
      outline={2}
      band={0}
      radius={radii.sm}
      style={style}
      faceStyle={[styles.tagFace, big && styles.tagFaceBig]}
    >
      <Text style={[styles.tagLabel, big && styles.tagLabelBig, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </ArcadeBevel>
  );
}

interface ArcadeFlagProps {
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** The tiny plaque tab — "START" over the current level. */
export function ArcadeFlag({ label, style }: ArcadeFlagProps) {
  return (
    <ArcadeBevel
      face={colors.arcadePlaque}
      deep={colors.arcadePlaqueDeep}
      drop={2}
      outline={2}
      band={0}
      radius={7}
      style={style}
      faceStyle={styles.flagFace}
    >
      <Text style={styles.flagLabel}>{label.toUpperCase()}</Text>
    </ArcadeBevel>
  );
}

const SWITCH_W = 64;
const SWITCH_H = 32;
const KNOB = 24;

interface ArcadeSwitchProps {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

/** A bevel toggle: green face when on, the cream knob sliding across. */
export function ArcadeSwitch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  style,
}: ArcadeSwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        void haptics.lightTap();
        onValueChange(!value);
      }}
      style={[disabled && styles.disabled, style]}
    >
      <ArcadeBevel
        face={value ? colors.arcadeGreen : colors.arcadeNeutral}
        deep={value ? colors.arcadeGreenDeep : colors.arcadeNeutralDeep}
        drop={3}
        outline={3}
        band={4}
        radius={SWITCH_H / 2}
        faceStyle={styles.switchFace}
      >
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]}>
          <View style={styles.knobBand} />
        </View>
      </ArcadeBevel>
    </Pressable>
  );
}

export const ARCADE_BADGE = 24;

interface ArcadeBadgeProps {
  readonly kind: 'check' | 'lock';
  readonly style?: StyleProp<ViewStyle>;
}

/** The round bevel badge on a level node: a green check or a neutral lock. */
export function ArcadeBadge({ kind, style }: ArcadeBadgeProps) {
  const done = kind === 'check';
  return (
    <ArcadeBevel
      face={done ? colors.arcadeGreen : colors.arcadeNeutral}
      deep={done ? colors.arcadeGreenDeep : colors.arcadeNeutralDeep}
      drop={2}
      outline={2}
      band={2}
      radius={ARCADE_BADGE / 2}
      style={style}
      faceStyle={styles.badgeFace}
    >
      {done ? (
        <Text style={styles.badgeCheck}>✓</Text>
      ) : (
        <Ionicons name="lock-closed" size={12} color={colors.arcadeCream} style={styles.badgeIcon} />
      )}
    </ArcadeBevel>
  );
}

interface ArcadeToastProps {
  readonly title: string;
  readonly detail?: string;
  readonly onDismiss?: () => void;
  readonly leading?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/** The dark toast: a gold pixel title over a mono detail line, ✕ to dismiss. */
export function ArcadeToast({ title, detail, onDismiss, leading, style }: ArcadeToastProps) {
  return (
    <View style={[styles.toast, style]}>
      {leading}
      <View style={styles.toastText}>
        <Text style={styles.toastTitle} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
        {detail ? <Text style={styles.toastDetail}>{detail}</Text> : null}
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          hitSlop={8}
          style={styles.toastClose}
        >
          <Text style={styles.toastCloseGlyph}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.arcadeInk,
  },
  face: {
    borderColor: colors.arcadeInk,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  disabled: {
    opacity: 0.4,
  },
  square: {
    width: ARCADE_SQUARE,
  },
  squareFace: {
    height: ARCADE_SQUARE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 3,
  },
  squareFaceOpen: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 0,
  },
  marqueeFace: {
    alignItems: 'center',
    paddingTop: 1,
    paddingBottom: 5,
    paddingHorizontal: spacing.sm - 2,
  },
  marqueeTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 26,
    letterSpacing: 1,
    color: colors.arcadeCream,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  marqueeSub: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 15,
    color: colors.arcadeGold,
    includeFontPadding: false,
    marginTop: 1,
    ...arcadeShadow.soft,
  },
  stripFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 3,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xxs,
  },
  stripFaceCompact: {
    paddingTop: 2,
    paddingBottom: 7,
    paddingHorizontal: spacing.sm - 2,
  },
  cell: {
    alignItems: 'center',
    minWidth: 0,
  },
  cellLabel: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 16,
    letterSpacing: 2,
    color: colors.arcadeGold,
    opacity: 0.85,
    includeFontPadding: false,
    ...arcadeShadow.soft,
  },
  cellLabelCompact: {
    fontSize: 12,
    lineHeight: 13,
    letterSpacing: 1,
  },
  cellValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 30,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    ...arcadeShadow.deep,
  },
  cellValueCompact: {
    fontSize: 26,
    lineHeight: 26,
  },
  divider: {
    width: 2,
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: 1,
    backgroundColor: colors.arcadeInk,
    opacity: 0.8,
  },
  tagFace: {
    paddingHorizontal: spacing.md,
    paddingBottom: 2,
    alignItems: 'center',
  },
  tagFaceBig: {
    minWidth: 96,
  },
  tagLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    ...arcadeShadow.deep,
  },
  tagLabelBig: {
    fontSize: 32,
    lineHeight: 34,
  },
  flagFace: {
    paddingHorizontal: 7,
    paddingBottom: 2,
  },
  flagLabel: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: 1,
    color: colors.arcadeGold,
    includeFontPadding: false,
    ...arcadeShadow.soft,
  },
  switchFace: {
    width: SWITCH_W,
    height: SWITCH_H,
  },
  knob: {
    position: 'absolute',
    top: 1,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.arcadeCream,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    overflow: 'hidden',
  },
  knobOff: {
    left: 1,
  },
  knobOn: {
    right: 1,
  },
  knobBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.arcadeChipCreamDeep,
  },
  badgeFace: {
    width: ARCADE_BADGE,
    height: ARCADE_BADGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCheck: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 17,
    color: colors.arcadeCream,
    includeFontPadding: false,
    marginBottom: 2,
    ...arcadeShadow.soft,
  },
  badgeIcon: {
    marginBottom: 2,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xxs,
    paddingVertical: spacing.sm - 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.arcadeToastFill,
    borderWidth: 2,
    borderColor: colors.arcadeInfoEdge,
  },
  toastText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  toastTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 1,
    color: colors.arcadeGold,
    includeFontPadding: false,
  },
  toastDetail: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption,
    lineHeight: fontSizes.caption + 2,
    color: colors.arcadeMuted,
  },
  toastClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.arcadeInfoEdge,
    backgroundColor: colors.arcadeStripFace,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCloseGlyph: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption,
    color: colors.arcadeMuted,
  },
});
