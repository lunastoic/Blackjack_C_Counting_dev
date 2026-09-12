import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../../theme';
import { ArcadeButton } from './ArcadeButton';
import { ArcadeInfoBox, ArcadePanel, ArcadeTab } from './ArcadePanel';

interface ArcadeTutorialPanelProps {
  /** "LEVEL 2", "HI-LO". */
  readonly kicker: string;
  /** "1 OF 5" — left out on a one-slide walkthrough. */
  readonly progress?: string;
  readonly title: string;
  /** The primer tints each beat's title by its Hi-Lo value. */
  readonly titleColor?: string;
  readonly body: string;
  readonly nextLabel: string;
  readonly onNext: () => void;
  /** Hidden on the last slide. */
  readonly onSkip?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The Modern look's walkthrough card: one primer beat or level slide on the
 * felt, under the deck that acts it out. Short on purpose — the stage above
 * is the picture.
 */
export function ArcadeTutorialPanel({
  kicker,
  progress,
  title,
  titleColor = colors.arcadeGold,
  body,
  nextLabel,
  onNext,
  onSkip,
  style,
}: ArcadeTutorialPanelProps) {
  return (
    <ArcadePanel style={[styles.panel, style]}>
      <View style={styles.header}>
        <ArcadeTab label={kicker} />
        {progress ? <Text style={styles.progress}>{progress.toUpperCase()}</Text> : null}
      </View>
      {/* Wraps, never shrinks — see ArcadePlaque. */}
      <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
        {title.toUpperCase()}
      </Text>
      <ArcadeInfoBox>{body}</ArcadeInfoBox>
      <ArcadeButton label={nextLabel} onPress={onNext} size="large" style={styles.next} />
      {onSkip ? (
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
        >
          <Text style={styles.skipLabel}>Skip</Text>
        </Pressable>
      ) : null}
    </ArcadePanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  progress: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption,
    letterSpacing: 3,
    color: colors.arcadeMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  next: {
    alignSelf: 'stretch',
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: spacing.xxs,
  },
  skipPressed: {
    opacity: 0.6,
  },
  skipLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.small,
    color: colors.arcadeMuted,
    textDecorationLine: 'underline',
  },
});
