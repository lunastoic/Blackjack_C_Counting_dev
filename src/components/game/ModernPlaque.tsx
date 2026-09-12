import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, spacing } from '../../theme';
import { ArcadeTab } from '../arcade';

interface ModernPlaqueProps {
  /** The kicker on the tab above the plaque — "HAND OVER", "COUNT CHECK". */
  readonly tab: string;
  readonly title: string;
  /** The title's colour; the plaque's gold when unset. */
  readonly color?: string;
  /** The smaller face for a question-length title. */
  readonly small?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The Modern table's result plaque: a kicker tab on the burgundy plaque
 * with a big pixel title that takes the outcome's colour. The kit's
 * ArcadePlaque keeps its title gold, so the table draws its own body.
 */
export function ModernPlaque({ tab, title, color = colors.arcadeGold, small = false, style }: ModernPlaqueProps) {
  return (
    <View style={[styles.slot, style]}>
      <ArcadeTab label={tab} style={styles.tab} />
      <View style={styles.body}>
        <Text style={[styles.title, small && styles.titleSmall, { color }]}>{title.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  /** The tab sits on the plaque's top edge, square-bottomed. */
  tab: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: spacing.xxs + 1,
    paddingBottom: 0,
    paddingHorizontal: spacing.xl,
    marginBottom: -2,
    zIndex: 1,
  },
  body: {
    alignSelf: 'stretch',
    backgroundColor: colors.arcadePlaque,
    borderWidth: 2,
    borderColor: colors.arcadePlaqueEdge,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs + spacing.xxs,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: 1,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
  titleSmall: {
    fontSize: 32,
    lineHeight: 32,
  },
});
