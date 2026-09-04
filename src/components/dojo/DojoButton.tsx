import React from 'react';
import { StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { PressableScale } from '../common/PressableScale';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

interface DojoButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary';
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function DojoButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: DojoButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[styles.button, isPrimary ? styles.primary : styles.secondary, disabled && styles.disabled, style]}
    >
      <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  primary: {
    backgroundColor: colors.gold,
  },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  label: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  primaryLabel: {
    color: colors.textOnGold,
  },
  secondaryLabel: {
    color: colors.goldBright,
  },
  labelDisabled: {
    color: colors.backgroundElevated,
  },
});
