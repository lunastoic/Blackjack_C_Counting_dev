import React from 'react';
import { StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { PressableScale } from './PressableScale';

interface SecondaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** Burgundy outline button for secondary actions. */
export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityHint,
  style,
}: SecondaryButtonProps) {
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
    minHeight: layout.touchTarget,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  disabled: {
    borderColor: colors.disabled,
    backgroundColor: colors.backgroundElevated,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.3,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
