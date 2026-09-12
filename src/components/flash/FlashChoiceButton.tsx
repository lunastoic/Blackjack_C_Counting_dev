import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { ArcadeButton, ArcadeButtonVariant } from '../arcade/ArcadeButton';
import { PressableScale } from '../common/PressableScale';

export type FlashChoiceState = 'idle' | 'correct' | 'wrong';

/** Modern reveal: the right answer goes green, a wrong pick red. */
const ARCADE_VARIANTS: Readonly<Record<FlashChoiceState, ArcadeButtonVariant>> = {
  idle: 'neutral',
  correct: 'green',
  wrong: 'red',
};

interface FlashChoiceButtonProps {
  readonly label: string;
  readonly state: FlashChoiceState;
  readonly disabled?: boolean;
  /** Tighter padding and type for wide pads (−5 … +5). */
  readonly compact?: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
}

/**
 * Count choice on the drill's card stock: burgundy gradient, hairline gold
 * frame, a sheen along the top edge. Reveals green for the right answer and
 * red for a wrong pick. The Modern look draws it as an arcade bevel instead.
 */
export function FlashChoiceButton({
  label,
  state,
  disabled = false,
  compact = false,
  onPress,
  accessibilityLabel,
}: FlashChoiceButtonProps) {
  const modern = useModernUi();
  const isCorrect = state === 'correct';
  const isWrong = state === 'wrong';
  if (modern) {
    return (
      <ArcadeButton
        label={label}
        onPress={onPress}
        disabled={disabled}
        dimDisabled={false}
        accessibilityLabel={accessibilityLabel}
        variant={ARCADE_VARIANTS[state]}
        size={compact ? 'small' : 'medium'}
        style={isWrong && styles.arcadeWrong}
      />
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.frame,
        isCorrect && styles.frameCorrect,
        isWrong && styles.frameWrong,
      ]}
    >
      <LinearGradient
        colors={[colors.surfaceRaised, colors.backgroundElevated]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.gradient, compact && styles.gradientCompact]}
      >
        <View style={styles.sheen} />
        <Text
          style={[
            styles.label,
            compact && styles.labelCompact,
            isCorrect && styles.labelCorrect,
            isWrong && styles.labelWrong,
          ]}
        >
          {label}
        </Text>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.backgroundElevated,
    overflow: 'hidden',
  },
  frameCorrect: {
    borderColor: colors.success,
  },
  frameWrong: {
    borderColor: colors.error,
    opacity: 0.75,
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  gradientCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 44,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: colors.goldDim,
    opacity: 0.55,
  },
  label: {
    color: colors.goldBright,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  labelCompact: {
    fontSize: fontSizes.subtitle,
  },
  labelCorrect: {
    color: colors.success,
  },
  labelWrong: {
    color: colors.error,
  },
  arcadeWrong: {
    opacity: 0.75,
  },
});
