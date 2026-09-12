import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ArcadePanel } from '../arcade';
import { colors, fonts, spacing } from '../../theme';

/**
 * The Modern sprint's felt panels: the question, the review and the grand
 * prize each sit in one, headed by a burgundy plaque whose body runs a size
 * down from the intro plaque and takes a win / lose tint. Local to the quiz
 * until ArcadePlaque grows a small + tone variant.
 */

const PLAQUE_RADIUS = 18;
const TAB_RADIUS = 14;

interface SprintPanelProps {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export function SprintPanel({ children, style }: SprintPanelProps) {
  return <ArcadePanel style={[styles.panel, style]}>{children}</ArcadePanel>;
}

export type SprintPlaqueTone = 'gold' | 'win' | 'lose' | 'push';

interface SprintPlaqueProps {
  /** The cream line on the tab above the body — "8 CARDS · 1 DECOY". */
  readonly tab: string;
  readonly body: string;
  readonly tone?: SprintPlaqueTone;
  /** Drop the body to 32px for the longer question line. */
  readonly small?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

const TONE_COLORS: Readonly<Record<SprintPlaqueTone, string>> = {
  gold: colors.arcadeGold,
  win: colors.arcadeMint,
  lose: colors.trainingMinus,
  push: colors.arcadeMuted,
};

export function SprintPlaque({ tab, body, tone = 'gold', small = false, style }: SprintPlaqueProps) {
  return (
    <View style={[styles.plaqueSlot, style]}>
      <View style={styles.plaqueTab}>
        <Text style={styles.plaqueTabLabel} numberOfLines={1}>
          {tab.toUpperCase()}
        </Text>
      </View>
      <View style={styles.plaque}>
        <Text
          style={[styles.plaqueBody, small && styles.plaqueBodySmall, { color: TONE_COLORS[tone] }]}
          numberOfLines={2}
        >
          {body.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingTop: spacing.xxs + spacing.xxs,
    paddingBottom: spacing.sm + spacing.xxs,
    gap: spacing.xs + spacing.xxs,
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
    paddingTop: spacing.xxs + 1,
    marginBottom: -2,
    zIndex: 1,
  },
  plaqueTabLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
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
    paddingTop: spacing.xs + spacing.xxs,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  plaqueBody: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  plaqueBodySmall: {
    fontSize: 32,
    lineHeight: 32,
  },
});
