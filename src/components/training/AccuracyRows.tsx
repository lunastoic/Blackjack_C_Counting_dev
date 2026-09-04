import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { accuracyPercent, CheckpointTally, QuestionKind } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';
import { kindLabel } from './copy';

export interface AccuracyRow {
  readonly label: string;
  readonly value: string;
  readonly strong?: boolean;
}

const KIND_ORDER: readonly QuestionKind[] = ['runningCount', 'decksRemaining', 'trueCount'];

/** "RUNNING COUNT 95% · DECK ESTIMATION 92% · TRUE COUNT 91% · OVERALL 93%". */
export function accuracyRows(tally: CheckpointTally): AccuracyRow[] {
  const rows: AccuracyRow[] = [];
  for (const kind of KIND_ORDER) {
    const percent = accuracyPercent(tally.byKind[kind]);
    if (percent !== null) {
      rows.push({ label: kindLabel(kind).toUpperCase(), value: `${percent}%` });
    }
  }
  const overall = accuracyPercent(tally);
  if (overall !== null) {
    rows.push({ label: 'OVERALL', value: `${overall}%`, strong: true });
  }
  return rows;
}

/** The exam's scorecard. */
export function AccuracyRows({ rows }: { readonly rows: readonly AccuracyRow[] }) {
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.label} style={[styles.row, row.strong && styles.rowStrong]}>
          <Text style={[styles.label, row.strong && styles.labelStrong]}>{row.label}</Text>
          <Text style={[styles.value, row.strong && styles.valueStrong]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
  },
  rowStrong: {
    borderTopWidth: 1,
    borderTopColor: colors.borderGold,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
  labelStrong: {
    color: colors.textPrimary,
  },
  value: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  valueStrong: {
    color: colors.goldBright,
    fontSize: fontSizes.title,
  },
});
