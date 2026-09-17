import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { decisionLabel, IndexPlayItem } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { PlayingCard } from '../game/PlayingCard';
import { formatDecks } from './copy';

interface IndexPlayStageProps {
  readonly item: IndexPlayItem;
  readonly cardWidth: number;
  readonly speed: number;
  /** Show the index and the call (after an answer). */
  readonly reveal: boolean;
  readonly serial: number;
}

/** The dealer's card over the player's hand, and the count the call is made on. */
export function IndexPlayStage({ item, cardWidth, speed, reveal, serial }: IndexPlayStageProps) {
  const count = item.decksRemaining === 1 && item.runningCount === item.trueCount
    ? `TRUE COUNT ${formatCount(item.trueCount)}`
    : `${formatCount(item.runningCount)} ÷ ${formatDecks(item.decksRemaining)} DECKS`;
  const verdict = `${item.label}: ${item.question === 'insurance' ? 'take it' : 'deviate'} at ${formatCount(
    item.index,
  )} or higher · TC ${formatCount(item.trueCount)} → ${decisionLabel(item.correct)}`;
  return (
    <View key={serial} style={styles.stage}>
      <Text style={styles.label}>DEALER</Text>
      <PlayingCard card={item.dealerUp} skin="regular" width={cardWidth} underglow={false} speed={speed} />
      <View style={styles.hand}>
        {item.playerCards.map((card, index) => (
          <View key={card.id} style={index > 0 ? styles.overlap : undefined}>
            <PlayingCard card={card} skin="regular" width={cardWidth} underglow={false} speed={speed} />
          </View>
        ))}
      </View>
      <View style={styles.count}>
        <Text style={styles.countText}>{count}</Text>
      </View>
      <Text style={styles.reveal}>{reveal ? verdict : ' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
  hand: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  overlap: {
    marginLeft: -spacing.lg,
  },
  count: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlayLight,
  },
  countText: {
    color: colors.goldBright,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  reveal: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
