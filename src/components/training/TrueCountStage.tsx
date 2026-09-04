import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TrueCountItem } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatDecks } from './copy';

interface TrueCountStageProps {
  readonly item: TrueCountItem;
  /** Show the division worked out (after an answer). */
  readonly reveal: boolean;
  readonly serial: number;
}

/** Running count ÷ decks remaining, as two big figures on the felt. */
export function TrueCountStage({ item, reveal, serial }: TrueCountStageProps) {
  return (
    <View key={serial} style={styles.stage}>
      <View style={styles.row}>
        <Figure label="RUNNING COUNT" value={formatCount(item.runningCount)} />
        <Text style={styles.divide}>÷</Text>
        <Figure label="DECKS LEFT" value={formatDecks(item.decksRemaining)} />
      </View>
      <Text style={styles.reveal}>
        {reveal
          ? `${formatCount(item.runningCount)} ÷ ${formatDecks(item.decksRemaining)} = ${formatCount(
              item.correct,
            )}`
          : ' '}
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
  reveal: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
});
