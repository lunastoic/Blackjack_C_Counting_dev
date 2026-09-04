import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DojoButton } from './DojoButton';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

interface CountingKeyboardProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly onSubmit?: () => void;
  readonly submitLabel?: string;
  readonly disabled?: boolean;
}

export function CountingKeyboard({
  value,
  onChange,
  onSubmit,
  submitLabel = 'Submit',
  disabled = false,
}: CountingKeyboardProps) {
  return (
    <View style={styles.root}>
      <View style={styles.display}>
        <Text style={styles.displayLabel}>RUNNING COUNT</Text>
        <Text style={styles.displayValue}>{value > 0 ? `+${value}` : value}</Text>
      </View>
      <View style={styles.pad}>
        <DojoButton
          label="−1"
          variant="secondary"
          disabled={disabled}
          onPress={() => onChange(value - 1)}
        />
        <DojoButton
          label="0"
          variant="secondary"
          disabled={disabled}
          onPress={() => onChange(0)}
        />
        <DojoButton
          label="+1"
          variant="secondary"
          disabled={disabled}
          onPress={() => onChange(value + 1)}
        />
      </View>
      {onSubmit ? (
        <DojoButton label={submitLabel} disabled={disabled} onPress={onSubmit} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  display: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.lg,
  },
  displayLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
  displayValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  pad: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
