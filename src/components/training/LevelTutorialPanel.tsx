import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TutorialSlide } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';
import { PrimaryButton } from '../common/PrimaryButton';
import { FlashPanel } from '../flash/FlashPanel';

interface LevelTutorialPanelProps {
  readonly level: number;
  readonly slides: readonly TutorialSlide[];
  readonly step: number;
  readonly onNext: () => void;
  readonly onSkip: () => void;
}

/** One slide of a level's walkthrough: title, a line or two, Next / Deal me in. */
export function LevelTutorialPanel({ level, slides, step, onNext, onSkip }: LevelTutorialPanelProps) {
  const slide = slides[Math.min(Math.max(step, 0), slides.length - 1)];
  const last = step + 1 >= slides.length;
  return (
    <FlashPanel kicker={`LEVEL ${level}`} subKicker={`${step + 1} OF ${slides.length}`}>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
      <View style={styles.actions}>
        <PrimaryButton label={last ? 'Deal me in' : 'Next'} onPress={onNext} />
        {last ? null : (
          <Text style={styles.skip} onPress={onSkip} accessibilityRole="button">
            Skip
          </Text>
        )}
      </View>
    </FlashPanel>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.goldBright,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skip: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
});
