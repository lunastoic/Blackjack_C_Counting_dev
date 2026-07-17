import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Rank } from '../../engine/cards/card';
import { PlayerAction } from '../../engine/blackjack/rules';
import { recommendAction } from '../../engine/strategy/recommend';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { ModalSheet } from '../common/ModalSheet';

/**
 * Basic strategy chart COMPUTED from the strategy engine (never a second,
 * hand-maintained copy of the tables — chart and hints can't disagree).
 */

const UPCARDS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

const LETTER: Record<PlayerAction, string> = { hit: 'H', stand: 'S', double: 'D', split: 'P' };

const LETTER_COLOR: Record<string, string> = {
  H: colors.trainingMinus,
  S: colors.trainingNeutral,
  D: colors.gold,
  P: colors.trainingPlus,
};

function rowFor(cards: readonly Rank[], canSplit: boolean): string[] {
  return UPCARDS.map(
    (up) =>
      LETTER[
        recommendAction(
          { cards: cards.map((rank) => ({ rank })), isFromSplit: false },
          up,
          { canDouble: true, canSplit },
        ).preferredAction
      ],
  );
}

interface ChartRow {
  readonly label: string;
  readonly cells: readonly string[];
}

function buildChart(): { hard: ChartRow[]; soft: ChartRow[]; pairs: ChartRow[] } {
  const hard: ChartRow[] = [];
  for (let total = 5; total <= 17; total++) {
    // Two non-pair, ace-free cards reaching the total.
    const cards: Rank[] =
      total <= 12
        ? ['2', String(total - 2) as Rank]
        : ['10', String(total - 10) as Rank];
    hard.push({ label: total === 17 ? '17+' : String(total), cells: rowFor(cards, false) });
  }

  const soft: ChartRow[] = [];
  for (let total = 13; total <= 20; total++) {
    const kicker = String(total - 11) as Rank;
    soft.push({ label: `A,${kicker}`, cells: rowFor(['A', kicker], false) });
  }

  const pairRanks: Rank[] = ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const pairs: ChartRow[] = pairRanks.map((rank) => ({
    label: `${rank},${rank}`,
    cells: rowFor([rank, rank], true),
  }));

  return { hard, soft, pairs };
}

export function StrategyChartModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const chart = useMemo(buildChart, []);

  return (
    <ModalSheet visible={visible} title="Basic Strategy" onClose={onClose}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.legend}>
          <LegendItem letter="H" text="Hit" />
          <LegendItem letter="S" text="Stand" />
          <LegendItem letter="D" text="Double" />
          <LegendItem letter="P" text="Split" />
        </View>
        <Section title="Your hard total" rows={chart.hard} />
        <Section title="Soft totals (with an Ace)" rows={chart.soft} />
        <Section title="Pairs" rows={chart.pairs} />
        <Text style={styles.footnote}>
          Columns are the dealer&apos;s upcard. When a double is unavailable the correct fallback
          is shown on the buttons instead.
        </Text>
      </ScrollView>
    </ModalSheet>
  );
}

function LegendItem({ letter, text }: { letter: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <Text style={[styles.legendLetter, { color: LETTER_COLOR[letter] }]}>{letter}</Text>
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

function Section({ title, rows }: { title: string; rows: ChartRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.rowLabel, styles.headerText]}> </Text>
        {UPCARDS.map((up) => (
          <Text key={up} style={[styles.cell, styles.headerText]}>
            {up}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          {row.cells.map((cell, index) => (
            <Text
              key={`${row.label}-${UPCARDS[index]}`}
              style={[styles.cell, { color: LETTER_COLOR[cell] }]}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendLetter: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
  },
  section: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 1,
  },
  rowLabel: {
    width: 40,
    color: colors.textPrimary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
  },
  headerText: {
    color: colors.textMuted,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
