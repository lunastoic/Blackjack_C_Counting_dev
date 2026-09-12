import React from 'react';
import { StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fontSizes, fontWeights, layout, radii, shadows, spacing } from '../../theme';
import { ArcadeButton } from '../arcade/ArcadeButton';
import { PressableScale } from './PressableScale';

interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Gold call-to-action button (Start, Claim, Deal…). The Modern look draws
 * it as the gold arcade bevel; Classic keeps the flat gold plate.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityHint,
  style,
}: PrimaryButtonProps) {
  const modern = useModernUi();
  if (modern) {
    return (
      <ArcadeButton
        label={label}
        onPress={onPress}
        disabled={disabled}
        accessibilityHint={accessibilityHint}
        variant="gold"
        size="medium"
        style={style}
      />
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.touchTarget + 6,
    borderRadius: radii.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  disabled: {
    backgroundColor: colors.disabled,
  },
  label: {
    color: colors.textOnGold,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  labelDisabled: {
    color: colors.backgroundElevated,
  },
});
