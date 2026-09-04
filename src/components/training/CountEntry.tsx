import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { PressableScale } from '../common/PressableScale';
import { PrimaryButton } from '../common/PrimaryButton';

interface CountEntryProps {
  /** 1 for running counts, 0.5 for decks and true counts. */
  readonly step: 1 | 0.5;
  readonly min: number;
  readonly max: number;
  readonly initial: number;
  readonly format: (value: number) => string;
  readonly onSubmit: (value: number) => void;
  /** Resets the dial for a new question. */
  readonly serial: number;
}

/**
 * Exact entry for the mastery levels: nudge the dial with the keys and
 * submit. No multiple choice to lean on.
 */
export function CountEntry({ step, min, max, initial, format, onSubmit, serial }: CountEntryProps) {
  const [value, setValue] = useState(initial);
  const [seenSerial, setSeenSerial] = useState(serial);
  if (seenSerial !== serial) {
    setSeenSerial(serial);
    setValue(initial);
  }
  const big = step === 1 ? 5 : 1;
  const nudge = (delta: number) =>
    setValue((current) => Math.max(min, Math.min(max, Math.round((current + delta) * 2) / 2)));

  return (
    <View style={styles.entry}>
      <View style={styles.dialRow}>
        <Key label={format(-big)} onPress={() => nudge(-big)} />
        <Key label={format(-step)} onPress={() => nudge(-step)} />
        <View style={styles.dial} accessibilityLabel={`Current answer ${format(value)}`}>
          <Text style={styles.dialText}>{format(value)}</Text>
        </View>
        <Key label={format(step)} onPress={() => nudge(step)} />
        <Key label={format(big)} onPress={() => nudge(big)} />
      </View>
      <PrimaryButton label="Submit" onPress={() => onSubmit(value)} />
    </View>
  );
}

function Key({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`Adjust by ${label}`} style={styles.key}>
      <Text style={styles.keyText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  entry: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  key: {
    flex: 1,
    maxWidth: 64,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.backgroundElevated,
  },
  keyText: {
    color: colors.gold,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  dial: {
    minWidth: 96,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  dialText: {
    color: colors.goldBright,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
});
