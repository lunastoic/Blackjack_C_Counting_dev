import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BET_SPREAD_MAX } from '../../engine/betting/betRamp';
import { BetSizeItem } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatDecks, formatUnits } from './copy';

interface BetSizeStageProps {
  readonly item: BetSizeItem;
  /** The ramp under the figures: true count → units. */
  readonly showRamp: boolean;
  /** Show the sum worked out (after an answer). */
  readonly reveal: boolean;
  readonly serial: number;
}

/** The ramp's steps: "≤+2 1", "+3 2" … "+9 8". */
const RAMP = Array.from({ length: BET_SPREAD_MAX }, (_, index) => ({
  trueCount: index === 0 ? '≤+2' : formatCount(index + 2),
  units: index + 1,
}));

/** Running count ÷ decks left, and the bet the true count calls for. */
export function BetSizeStage({ item, showRamp, reveal, serial }: BetSizeStageProps) {
  return (
    <View key={serial} style={styles.stage}>
      <View style={styles.row}>
        <Figure label="RUNNING COUNT" value={formatCount(item.runningCount)} />
        <Text style={styles.divide}>÷</Text>
        <Figure label="DECKS LEFT" value={formatDecks(item.decksRemaining)} />
      </View>
      {showRamp ? (
        <View style={styles.ramp} accessibilityLabel="Bet ramp: true count minus one units, one to eight">
          {RAMP.map((step) => (
            <View
              key={step.units}
              style={[styles.step, reveal && step.units === item.correct && styles.stepHit]}
            >
              <Text style={styles.stepCount}>{step.trueCount}</Text>
              <Text style={styles.stepUnits}>{step.units}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.reveal}>
        {reveal
          ? `${formatCount(item.runningCount)} ÷ ${formatDecks(item.decksRemaining)} → TC ${formatCount(
              item.trueCount,
            )} → ${formatUnits(item.correct)}`
          : 'TRUE COUNT, ROUNDED DOWN, MINUS ONE'}
      </Text>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  figure: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 120,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlayLight,
  },
  figureLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
  figureValue: {
    color: colors.goldBright,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  divide: {
    color: colors.textSecondary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
  },
  ramp: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  step: {
    alignItems: 'center',
    minWidth: 38,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.overlayLight,
  },
  stepHit: {
    borderColor: colors.goldBright,
  },
  stepCount: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  stepUnits: {
    color: colors.goldBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  reveal: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
});
