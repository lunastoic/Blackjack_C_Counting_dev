import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

interface FlashPanelProps {
  /** Small-caps headline set between two hairline rules. */
  readonly kicker?: string;
  readonly kickerColor?: string;
  /** A second small-caps line set directly under the kicker (a slide count). */
  readonly subKicker?: string;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The drill's card stock: burgundy gradient, gold frame, a sheen along the
 * top edge, and an engraved kicker line. One look for the tutorial beats,
 * the round brief, and anything else that sits on the felt.
 */
export function FlashPanel({ kicker, kickerColor = colors.gold, subKicker, children, style }: FlashPanelProps) {
  return (
    <View style={[styles.frame, style]}>
      <LinearGradient
        colors={[colors.surfaceRaised, colors.backgroundElevated]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.sheen} />
        {kicker ? (
          <View style={styles.kickerRow}>
            <View style={styles.rule} />
            <Text style={[styles.kicker, { color: kickerColor }]}>{kicker}</Text>
            <View style={styles.rule} />
          </View>
        ) : null}
        {kicker && subKicker ? (
          <Text style={[styles.kicker, styles.subKicker, { color: kickerColor }]}>{subKicker}</Text>
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
  subKicker: {
    textAlign: 'center',
    marginTop: -spacing.xs,
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
});
