import React from 'react';
import { StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { colors, fontSizes, fontWeights, layout, radii } from '../../theme';
import { PressableScale } from './PressableScale';

interface IconButtonProps {
  /** Short glyph or text (e.g. "‹", "×", "+", "−"). Not an emoji. */
  readonly glyph: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Small square tap target using simple text glyphs, which render identically
 * on iOS and Android (no iOS-only SF Symbols for important controls).
 */
export function IconButton({
  glyph,
  accessibilityLabel,
  onPress,
  disabled = false,
  style,
}: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      <Text style={[styles.glyph, disabled && styles.glyphDisabled]}>{glyph}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.disabled,
  },
  glyph: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.title + 4,
  },
  glyphDisabled: {
    color: colors.textMuted,
  },
});
