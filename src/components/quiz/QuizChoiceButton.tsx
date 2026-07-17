import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { PressableScale } from '../common/PressableScale';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

export type ChoiceState = 'idle' | 'correct' | 'wrong';

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
 * was the right answer (green glow) or a wrong pick (red tint).
 */
export function QuizChoiceButton({
  value,
  label,
  state,
  disabled = false,
  onPress,
  accessibilityLabel,
}: QuizChoiceButtonProps) {
  const isCorrect = state === 'correct';
  const isWrong = state === 'wrong';

  return (
    <Animated.View
      entering={FadeIn.duration(200).delay(Math.abs(value) * 30)}
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
