import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '../../theme';

/**
 * The Modern look's intro furniture: a felt panel and the pieces that sit on
 * it — the burgundy plaque, the tabs, the pills and the mono description box.
 * Everything is drawn in code; the pixel face carries every headline.
 */

const PANEL_RADIUS = 26;
const PANEL_EDGE = 3;
const PLAQUE_RADIUS = 18;
const TAB_RADIUS = 14;

interface ArcadePanelProps {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

/** Green felt with a lighter felt edge; the intro's ground. */
export function ArcadePanel({ children, style, onLayout }: ArcadePanelProps) {
  return (
    <View style={[styles.panel, style]} onLayout={onLayout}>
      <LinearGradient
        colors={[colors.arcadeFelt, colors.arcadeFeltDeep]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

interface ArcadePlaqueProps {
  /** The small line on the tab above the title, e.g. "LEVEL 1". */
  readonly kicker: string;
  readonly title: string;
  /** Hangs off the plaque's bottom edge, half in and half out. */
  readonly footer?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/** Burgundy plaque: the kicker on a tab over the big gold title. */
export function ArcadePlaque({ kicker, title, footer, style }: ArcadePlaqueProps) {
  return (
    <View style={[styles.plaqueSlot, style]}>
      <View style={styles.plaqueTab}>
        <Text style={styles.plaqueKicker}>{kicker.toUpperCase()}</Text>
      </View>
      <View style={styles.plaque}>
        {/* One line, shrunk to fit. No lineHeight here: with one set, iOS's
            fit loop leaves a tall empty box and a microscopic title. */}
        <Text style={styles.plaqueTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title.toUpperCase()}
        </Text>
      </View>
      {footer ? <View style={styles.plaqueFooter}>{footer}</View> : null}
    </View>
  );
}

interface ArcadeTabProps {
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** A small burgundy tab with a gold pixel label — "STAR GOALS". */
export function ArcadeTab({ label, style }: ArcadeTabProps) {
  return (
    <View style={[styles.tab, style]}>
      <Text style={styles.tabLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

interface ArcadePillProps {
  readonly label: string;
  /** Mint outline and text for the difficulty pill; muted mono otherwise. */
  readonly tone?: 'mint' | 'muted';
  readonly style?: StyleProp<ViewStyle>;
}

export function ArcadePill({ label, tone = 'muted', style }: ArcadePillProps) {
  const mint = tone === 'mint';
  return (
    <View style={[styles.pill, mint && styles.pillMint, style]}>
      <Text style={[styles.pillLabel, mint && styles.pillLabelMint]}>
        {mint ? label.toUpperCase() : label}
      </Text>
    </View>
  );
}

interface ArcadeInfoBoxProps {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/** The dark translucent box the description sits in, set in the mono face. */
export function ArcadeInfoBox({ children, style }: ArcadeInfoBoxProps) {
  return (
    <View style={[styles.infoBox, style]}>
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

/** An inset frame on the felt — the star goals live in one. */
export function ArcadeInset({ children, style }: ArcadePanelProps) {
  return <View style={[styles.inset, style]}>{children}</View>;
}

export const arcadeText = StyleSheet.create({
  /** Muted mono caption: "Your best run determines your stars." */
  caption: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    lineHeight: fontSizes.caption + 7,
    color: colors.arcadeMuted,
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  panel: {
    borderRadius: PANEL_RADIUS,
    borderWidth: PANEL_EDGE,
    borderColor: colors.arcadeFeltEdge,
    backgroundColor: colors.arcadeFelt,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'stretch',
  },
  plaqueSlot: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  plaqueTab: {
    backgroundColor: colors.arcadePlaque,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colors.arcadePlaqueEdge,
    borderTopLeftRadius: TAB_RADIUS,
    borderTopRightRadius: TAB_RADIUS,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxs,
    marginBottom: -2,
    zIndex: 1,
  },
  plaqueKicker: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.arcadeCream,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  plaque: {
    alignSelf: 'stretch',
    backgroundColor: colors.arcadePlaque,
    borderWidth: 2,
    borderColor: colors.arcadePlaqueEdge,
    borderRadius: PLAQUE_RADIUS,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  plaqueTitle: {
    fontFamily: fonts.display,
    fontSize: 40,
    letterSpacing: 1,
    color: colors.arcadeGold,
    textAlign: 'center',
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  plaqueFooter: {
    marginTop: -(spacing.md + spacing.xxs),
    alignItems: 'center',
  },
  tab: {
    backgroundColor: colors.arcadePlaque,
    borderWidth: 2,
    borderColor: colors.arcadePlaqueEdge,
    borderRadius: TAB_RADIUS,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xs,
    alignSelf: 'center',
  },
  tabLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.arcadeGold,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  pill: {
    alignSelf: 'center',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.arcadeInfoEdge,
    backgroundColor: colors.arcadeInfoFill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  pillMint: {
    borderColor: colors.arcadeMint,
    backgroundColor: colors.arcadeFeltDeep,
  },
  pillLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.small,
    color: colors.arcadeMuted,
  },
  pillLabelMint: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSizes.small,
    letterSpacing: 3,
    color: colors.arcadeMint,
  },
  infoBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.arcadeInfoFill,
    borderWidth: 2,
    borderColor: colors.arcadeInfoEdge,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    lineHeight: fontSizes.caption + 7,
    color: colors.arcadeCream,
    textAlign: 'center',
  },
  inset: {
    alignSelf: 'stretch',
    borderWidth: 2,
    borderColor: colors.arcadeFeltEdge,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs + spacing.xxs,
    alignItems: 'center',
  },
});
