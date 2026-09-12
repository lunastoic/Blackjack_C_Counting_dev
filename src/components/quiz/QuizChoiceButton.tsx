import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useModernUi } from '../../hooks/useModernUi';
import { ArcadeButton, ArcadeButtonVariant } from '../arcade/ArcadeButton';
import { PressableScale } from '../common/PressableScale';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

export type ChoiceState = 'idle' | 'correct' | 'wrong';

/** Modern reveal: the right answer goes green, a wrong pick red. */
const ARCADE_VARIANTS: Readonly<Record<ChoiceState, ArcadeButtonVariant>> = {
  idle: 'neutral',
  correct: 'green',
  wrong: 'red',
};

interface QuizChoiceButtonProps {
  readonly value: number;
  readonly label: string;
  readonly state: ChoiceState;
  readonly disabled?: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
}

/**
 * A large, tactile count-choice tile. In feedback mode it reveals whether it
 * was the right answer (green glow) or a wrong pick (red tint). The Modern
 * look draws it as an arcade bevel with the same reveal colours.
 */
export function QuizChoiceButton({
  value,
  label,
  state,
  disabled = false,
  onPress,
  accessibilityLabel,
}: QuizChoiceButtonProps) {
  const modern = useModernUi();
  const isCorrect = state === 'correct';
  const isWrong = state === 'wrong';

  const entering = useMemo(
    () => FadeIn.duration(200).delay(Math.abs(value) * 30),
    [value],
  );

  if (modern) {
    return (
      // The wrong-pick fade sits on the button, not the entering wrapper, so
      // the FadeIn never fights it for opacity.
      <Animated.View entering={entering} style={styles.arcadeCell}>
        <ArcadeButton
          label={label}
          onPress={onPress}
          disabled={disabled}
          dimDisabled={false}
          accessibilityLabel={accessibilityLabel}
          variant={ARCADE_VARIANTS[state]}
          size="large"
          style={isWrong && styles.wrongWrapper}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={entering}
      style={[
        styles.wrapper,
        isCorrect && styles.correctWrapper,
        isWrong && styles.wrongWrapper,
      ]}
    >
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        style={[styles.button, isCorrect && styles.correctButton, isWrong && styles.wrongButton]}
      >
        <Text
          style={[
            styles.label,
            isCorrect && styles.correctLabel,
            isWrong && styles.wrongLabel,
          ]}
        >
          {label}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const baseBorder = {
  borderWidth: 2,
  borderColor: colors.gold,
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  correctWrapper: {
    ...shadows.raised,
    shadowColor: colors.success,
  },
  wrongWrapper: {
    opacity: 0.7,
  },
  /** Two to a row in the sprint panel's grid; a lone odd tile stays half-width. */
  arcadeCell: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 120,
  },
  button: {
    minWidth: 96,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    backgroundColor: colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...baseBorder,
  },
  correctButton: {
    backgroundColor: 'rgba(61, 187, 110, 0.18)',
    borderColor: colors.success,
  },
  wrongButton: {
    backgroundColor: 'rgba(224, 82, 77, 0.12)',
    borderColor: colors.error,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  correctLabel: {
    color: colors.success,
  },
  wrongLabel: {
    color: colors.error,
  },
});
