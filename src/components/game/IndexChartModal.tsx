import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { INDEX_PLAYS, INSURANCE_INDEX } from '../../engine/strategy/indexPlays';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { ModalSheet } from '../common/ModalSheet';

/**
 * Kepler's gift: the index plays on a card. Every spot where the count, not
 * the chart, decides — the play to make at the index or above, and the one
 * below it. Read straight from the engine, so the table and the card agree.
 */

const ACTION_LABEL: Record<string, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
};

const ACTION_COLOR: Record<string, string> = {
  hit: colors.trainingMinus,
  stand: colors.trainingNeutral,
  double: colors.gold,
  split: colors.trainingPlus,
};

export function IndexChartModal({
  visible,
  onClose,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
}) {
  return (
    <ModalSheet visible={visible} title="Index plays" onClose={onClose}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.row, styles.insurance]}>
          <Text style={styles.spot}>Insurance</Text>
          <Text style={styles.index}>{formatCount(INSURANCE_INDEX)}+</Text>
          <Text style={[styles.action, { color: colors.trainingPlus }]}>Take</Text>
          <Text style={styles.below}>else no</Text>
        </View>
        {INDEX_PLAYS.map((play) => (
          <View key={play.id} style={styles.row}>
            <Text style={styles.spot}>{play.label}</Text>
            <Text style={styles.index}>{formatCount(play.index)}+</Text>
            <Text style={[styles.action, { color: ACTION_COLOR[play.action] }]}>
              {ACTION_LABEL[play.action]}
            </Text>
            <Text style={styles.below}>else {ACTION_LABEL[play.below].toLowerCase()}</Text>
          </View>
        ))}
        <Text style={styles.footnote}>
          True count rounded down. Above the index the count overrules the chart; below it, play the
          book.
        </Text>
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  insurance: {
    backgroundColor: colors.overlayLight,
    marginBottom: spacing.xs,
  },
  spot: {
    flex: 1.2,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  index: {
    width: 48,
    color: colors.goldBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  action: {
    width: 64,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    textAlign: 'right',
  },
  below: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSizes.small,
    textAlign: 'right',
  },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
});
