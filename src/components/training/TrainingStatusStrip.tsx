import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';

export interface StatusCell {
  readonly label: string;
  readonly value: string;
  /** Smaller trailing text — "/21", "s". */
  readonly dim?: string;
  /** Star glyphs after the dim text — the target the value is climbing toward. */
  readonly stars?: string;
  /** Padlock after the value (the deck count is fixed per level). */
  readonly locked?: boolean;
  readonly tone?: 'gold' | 'error';
  readonly accessibilityLabel?: string;
}

interface TrainingStatusStripProps {
  readonly cells: readonly StatusCell[];
}

const PLAQUE_COLORS = [colors.surfaceRaised, colors.surface, colors.backgroundElevated] as const;

// Fixed line heights, so the strip's height is a known number: the Modern
// brief hides it, and the felt print has to climb by exactly this much once
// it is out.
const LABEL_LINE = 12;
const VALUE_LINE = 22;
const CELL_GAP = 1;
const STRIP_PADDING_V = spacing.xs + spacing.xxs;
const STRIP_BORDER = 1;
/** The strip's full height: the felt below drops by this much once it is shown. */
export const TRAINING_STRIP_HEIGHT =
  LABEL_LINE + CELL_GAP + VALUE_LINE + (STRIP_PADDING_V + STRIP_BORDER) * 2;

/**
 * The drill's dashboard above the felt: streak or checks, misses, deck, pace.
 * A burgundy plaque with a gold rim and hairlines between the cells. The clock
 * is not a cell: it is the answer meter drawn underneath.
 */
export function TrainingStatusStrip({ cells }: TrainingStatusStripProps) {
  return (
    <View style={styles.strip}>
      <LinearGradient
        colors={PLAQUE_COLORS}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.highlight} pointerEvents="none" />
      {cells.map((cell, index) => (
        <React.Fragment key={cell.label}>
          {index > 0 ? <View style={styles.divider} pointerEvents="none" /> : null}
          <View
            style={styles.cell}
            accessibilityLabel={
              cell.accessibilityLabel ?? `${cell.label} ${cell.value}${cell.dim ?? ''}`
            }
          >
            <Text style={styles.label}>{cell.label}</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.value, cell.tone === 'error' && styles.valueError]}>
                {cell.value}
                {cell.dim ? <Text style={styles.valueDim}>{cell.dim}</Text> : null}
                {cell.stars ? <Text style={styles.valueStars}> {cell.stars}</Text> : null}
              </Text>
              {cell.locked ? (
                <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
              ) : null}
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: layout.screenPaddingH,
    paddingHorizontal: spacing.md,
    paddingVertical: STRIP_PADDING_V,
    borderRadius: radii.md,
    borderWidth: STRIP_BORDER,
    borderColor: colors.gold,
    overflow: 'hidden',
    shadowColor: colors.chipShadow,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  /** A lit top edge so the plaque reads as raised. */
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(240, 199, 94, 0.45)',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: spacing.xxs,
    backgroundColor: colors.borderGold,
  },
  cell: {
    alignItems: 'center',
    gap: CELL_GAP,
    minWidth: 56,
  },
  label: {
    color: colors.goldDim,
    fontSize: 10,
    lineHeight: LABEL_LINE,
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
    lineHeight: VALUE_LINE,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  valueError: {
    color: colors.error,
  },
  valueDim: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
  valueStars: {
    color: colors.gold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
});
