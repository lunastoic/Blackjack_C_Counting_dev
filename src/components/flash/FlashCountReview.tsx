import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Card, hiLoValue, withVisibility } from '../../engine/cards/card';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { PlayingCard } from '../game/PlayingCard';

interface FlashCountReviewProps {
  /** The three cards the player was shown this round, in deal order. */
  readonly cards: readonly Card[];
  /** Running count before this round's cards. */
  readonly startCount: number;
}

/**
 * After every answer: each shown card with its Hi-Lo value and the count as
 * it climbs, starting from where the level left off — the arithmetic, not
 * just the answer.
 */
export function FlashCountReview({ cards, startCount }: FlashCountReviewProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(26, Math.min(44, (width - 120) / Math.max(cards.length, 1) - 8));
  const annotated = cards.reduce<{ card: Card; delta: number; running: number }[]>(
    (acc, card) => {
      const delta = hiLoValue(card.rank);
      const running = (acc.at(-1)?.running ?? startCount) + delta;
      return [...acc, { card, delta, running }];
    },
    [],
  );
  return (
    <View style={styles.row} accessibilityLabel="Count breakdown">
      <View style={styles.column}>
        <Text style={styles.startLabel}>from</Text>
        <Text style={styles.running}>{formatCount(startCount)}</Text>
      </View>
      {annotated.map(({ card, delta, running }) => {
        const deltaColor =
          delta > 0 ? colors.trainingPlus : delta < 0 ? colors.trainingMinus : colors.trainingNeutral;
        return (
          <View key={card.id} style={styles.column}>
            <PlayingCard
              card={withVisibility(card, 'faceUp')}
              skin="regular"
              width={cardWidth}
              underglow={false}
            />
            <Text style={[styles.delta, { color: deltaColor }]}>{formatCount(delta)}</Text>
            <Text style={styles.running}>{formatCount(running)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  column: {
    alignItems: 'center',
    gap: 2,
  },
  startLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    marginBottom: spacing.xs,
  },
  delta: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  running: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
});
