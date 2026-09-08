import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';

export interface StatusCell {
  readonly label: string;
  readonly value: string;
  /** Smaller trailing text — "/21", "s". */
  readonly dim?: string;
  /** Padlock after the value (the deck count is fixed per level). */
  readonly locked?: boolean;
  readonly tone?: 'gold' | 'error';
  readonly accessibilityLabel?: string;
}

interface TrainingStatusStripProps {
  readonly cells: readonly StatusCell[];
}

/**
 * The drill's dashboard above the felt: streak or checks, misses, deck, pace.
 * The clock is not a cell: it is the answer meter drawn underneath.
 */
export function TrainingStatusStrip({ cells }: TrainingStatusStripProps) {
  return (
    <View style={styles.strip}>
      {cells.map((cell) => (
        <View
          key={cell.label}
          style={styles.cell}
          accessibilityLabel={cell.accessibilityLabel ?? `${cell.label} ${cell.value}${cell.dim ?? ''}`}
        >
          <Text style={styles.label}>{cell.label}</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, cell.tone === 'error' && styles.valueError]}>
              {cell.value}
              {cell.dim ? <Text style={styles.valueDim}>{cell.dim}</Text> : null}
            </Text>
            {cell.locked ? (
              <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: layout.screenPaddingH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlayLight,
  },
  cell: {
    alignItems: 'center',
    gap: 2,
    minWidth: 56,
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  value: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  valueError: {
    color: colors.error,
  },
  valueDim: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
});
