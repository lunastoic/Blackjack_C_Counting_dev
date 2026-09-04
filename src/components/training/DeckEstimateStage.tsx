import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import { DeckEstimateItem } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';
import { DeckGauge } from './DeckGauge';

interface DeckEstimateStageProps {
  readonly item: DeckEstimateItem;
  readonly showScale: boolean;
  /** Print the answer (after one). */
  readonly reveal: boolean;
  readonly serial: number;
}

/** A shoe part-way through: read the piles, call the decks left. */
export function DeckEstimateStage({ item, showScale, reveal, serial }: DeckEstimateStageProps) {
  const totalCards = item.shoeSize * CARDS_PER_DECK;
  const drawn = totalCards - item.cardsRemaining;
  return (
    <View key={serial} style={styles.stage}>
      <Text style={styles.kicker}>{item.shoeSize === 1 ? 'SINGLE DECK' : `${item.shoeSize}-DECK SHOE`}</Text>
      <View style={styles.row}>
        <DeckGauge
          variant="discard"
          count={drawn}
          totalCards={totalCards}
          showScale={showScale}
          label="DISCARDS"
        />
        <DeckGauge
          variant="shoe"
          count={item.cardsRemaining}
          totalCards={totalCards}
          showScale={showScale}
          label="SHOE"
        />
      </View>
      <Text style={styles.reveal}>
        {reveal ? `${item.cardsRemaining} cards left` : ' '}
      </Text>
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
  kicker: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.heavy,
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xxl,
  },
  reveal: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
});
