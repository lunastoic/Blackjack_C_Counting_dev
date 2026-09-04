import React from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CARD_BACK } from '../../assets/cards.generated';
import { hiLoValue } from '../../engine/cards/card';
import { QuizFlashCard } from '../../stores/quizSessionStore';
import { CARD_ASPECT, PlayingCard } from '../game/PlayingCard';
import { colors, fontSizes, fontWeights } from '../../theme';
import { formatCount } from '../../utils/countCoach';

interface QuizCountReviewProps {
  readonly flashCards: readonly QuizFlashCard[];
}

/**
 * Post-answer teaching row: every flashed card with its Hi-Lo value and the
 * running count beneath it, so a miss shows exactly where the count slipped.
 * Decoys show a dimmed back and contribute 0.
 */
export function QuizCountReview({ flashCards }: QuizCountReviewProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min((width - 64) / Math.max(flashCards.length, 1) - 4, 56);

  const annotated = flashCards.reduce<
    { item: QuizFlashCard; delta: number; running: number }[]
  >((acc, item) => {
    const delta = item.faceDown ? 0 : hiLoValue(item.card.rank);
    const running = (acc.at(-1)?.running ?? 0) + delta;
    return [...acc, { item, delta, running }];
  }, []);

  return (
    <View style={styles.row}>
      {annotated.map(({ item, delta, running }) => {
        const deltaColor =
          delta > 0 ? colors.success : delta < 0 ? colors.error : colors.textMuted;
        return (
          <View key={item.card.id} style={styles.column}>
            {item.faceDown ? (
              <Image
                source={CARD_BACK}
                style={{
                  width: cardWidth,
                  height: cardWidth / CARD_ASPECT,
                  borderRadius: 4,
                  opacity: 0.65,
                }}
                accessibilityLabel="Decoy card — counts zero"
              />
            ) : (
              <PlayingCard card={item.card} skin="regular" width={cardWidth} underglow={false} />
            )}
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
    alignItems: 'flex-start',
    gap: 4,
  },
  column: {
    alignItems: 'center',
    gap: 1,
  },
  delta: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  running: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontVariant: ['tabular-nums'],
  },
});
