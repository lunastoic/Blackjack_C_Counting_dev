import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import { FlashChoiceButton, FlashChoiceState } from '../flash/FlashChoiceButton';

/** Idle until answered; then the right value goes green and a wrong pick red. */
export function choiceState(
  value: number,
  selected: number | null,
  correct: number,
): FlashChoiceState {
  if (selected === null) {
    return 'idle';
  }
  if (value === correct) {
    return 'correct';
  }
  return value === selected ? 'wrong' : 'idle';
}

interface PadProps {
  readonly selected: number | null;
  readonly correct: number;
  readonly disabled?: boolean;
  readonly format: (value: number) => string;
  readonly onPress: (value: number) => void;
}

interface CountPadProps extends PadProps {
  /** Every whole value from −bound to +bound. */
  readonly bound: number;
}

/** Widest row that still reads at a glance; bigger pads wrap. */
const PAD_ROW = 7;

/**
 * The value pad — −1 / 0 / +1 for single cards, wider for groups. Every
 * possible net value is a button, so the answer is never a guess between
 * four options.
 */
export function CountPad({ bound, selected, correct, disabled, format, onPress }: CountPadProps) {
  const values = Array.from({ length: bound * 2 + 1 }, (_, index) => index - bound);
  // Balanced rows: 13 values → 7 + 6, 9 → 5 + 4, 5 → one row.
  const rowCount = Math.ceil(values.length / PAD_ROW);
  const perRow = Math.ceil(values.length / rowCount);
  const rows: number[][] = [];
  for (let start = 0; start < values.length; start += perRow) {
    rows.push(values.slice(start, start + perRow));
  }
  const cellWidth = `${Math.floor(100 / perRow) - 2}%` as const;
  return (
    <View style={styles.pad}>
      {rows.map((row) => (
        <View key={row[0]} style={styles.padRow}>
          {row.map((value) => (
            <View key={value} style={[styles.padCell, { width: cellWidth }]}>
              <FlashChoiceButton
                label={format(value)}
                state={choiceState(value, selected, correct)}
                compact={values.length > 3}
                disabled={disabled}
                onPress={() => onPress(value)}
                accessibilityLabel={`Answer ${format(value)}`}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

interface ChoiceGridProps extends PadProps {
  readonly choices: readonly number[];
}

/** Four answers, two per row. */
export function ChoiceGrid({ choices, selected, correct, disabled, format, onPress }: ChoiceGridProps) {
  return (
    <View style={styles.grid}>
      {choices.map((choice) => (
        <View key={choice} style={styles.gridCell}>
          <FlashChoiceButton
            label={format(choice)}
            state={choiceState(choice, selected, correct)}
            disabled={disabled}
            onPress={() => onPress(choice)}
            accessibilityLabel={`Answer ${format(choice)}`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  padCell: {
    maxWidth: 110,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  /** Two per row; the button stretches to fill the cell. */
  gridCell: {
    width: '47%',
  },
});
