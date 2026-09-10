import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

interface FlashPanelProps {
  /** Small-caps headline set between two hairline rules. */
  readonly kicker?: string;
  readonly kickerColor?: string;
  /** A small-caps line set directly above the kicker (a slide count). */
  readonly overline?: string;
  /**
   * Something to hang at the top right of the kicker line (the star targets
   * on a brief). The kicker moves to the left edge to make room.
   */
  readonly kickerAside?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The drill's card stock: burgundy gradient, gold frame, a sheen along the
 * top edge, and an engraved kicker line. One look for the tutorial beats,
 * the round brief, and anything else that sits on the felt.
 */
export function FlashPanel({
  kicker,
  kickerColor = colors.gold,
  overline,
  kickerAside,
  children,
  style,
}: FlashPanelProps) {
  return (
    <View style={[styles.frame, style]}>
      <LinearGradient
        colors={[colors.surfaceRaised, colors.backgroundElevated]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.sheen} />
        {kicker && overline ? (
          <Text style={[styles.kicker, styles.overline, { color: kickerColor }]}>{overline}</Text>
        ) : null}
        {kicker ? (
          <View style={styles.kickerRow}>
            {kickerAside ? null : <View style={styles.rule} />}
            <Text
              style={[styles.kicker, { color: kickerColor }, kickerAside ? styles.kickerAsideText : null]}
              numberOfLines={1}
            >
              {kicker}
            </Text>
            <View style={styles.rule} />
            {kickerAside}
          </View>
        ) : null}
        {children}
      </LinearGradient>
    </View>
  );
}

/** Small bordered stat pill for the brief ("6 in a row", "1 ♥", "1 deck"). */
export function FlashPanelChip({ label }: { readonly label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

/** The gold star-targets pill that hangs at the top right of a brief. */
export function FlashPanelStarChip({ label }: { readonly label: string }) {
  return (
    <View style={[styles.chip, styles.starChip]} accessibilityLabel={label}>
      <Text style={[styles.chipText, styles.starChipText]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.backgroundElevated,
    ...shadows.overlay,
  },
  gradient: {
    borderRadius: radii.lg - 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 1,
    backgroundColor: colors.goldDim,
    opacity: 0.6,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderGold,
  },
  kicker: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.heavy,
    letterSpacing: 3,
  },
  kickerAsideText: {
    flexShrink: 1,
  },
  overline: {
    textAlign: 'center',
    marginBottom: -spacing.xs,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.overlayLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
  },
  starChip: {
    borderColor: colors.borderGold,
    backgroundColor: colors.burgundyDeep,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
    flexShrink: 0,
  },
  starChipText: {
    color: colors.goldBright,
    fontWeight: fontWeights.bold,
  },
});
