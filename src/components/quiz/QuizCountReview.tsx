import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CARD_BACK } from '../../assets/cards.generated';
import { hiLoValue } from '../../engine/cards/card';
import { QuizFlashCard } from '../../stores/quizSessionStore';
import { CARD_ASPECT, PlayingCard } from '../game/PlayingCard';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';

/** The Modern row sits inside the sprint panel: stage 16 + panel edge 3 + panel pad 12 a side. */
const ARCADE_PANEL_INSET = 62;
const ARCADE_CARD_WIDTH = 38;

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
  const modern = useModernUi();
  const count = Math.max(flashCards.length, 1);
  const cardWidth = modern
    ? Math.min((width - ARCADE_PANEL_INSET) / count - 4, ARCADE_CARD_WIDTH)
    : Math.min((width - 64) / count - 4, 56);

  const annotated = flashCards.reduce<
    { item: QuizFlashCard; delta: number; running: number }[]
  >((acc, item) => {
    const delta = item.faceDown ? 0 : hiLoValue(item.card.rank);
    const running = (acc.at(-1)?.running ?? 0) + delta;
    return [...acc, { item, delta, running }];
  }, []);

  return (
    <View style={[styles.row, modern && styles.arcadeRow]}>
      {annotated.map(({ item, delta, running }) => {
        const deltaColor = modern
          ? delta > 0
            ? colors.trainingPlus
            : delta < 0
              ? colors.trainingMinus
              : colors.arcadeMuted
          : delta > 0
            ? colors.success
            : delta < 0
              ? colors.error
              : colors.textMuted;
        return (
          <View key={item.card.id} style={[styles.column, modern && styles.arcadeColumn]}>
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
            <Text style={[styles.delta, modern && styles.arcadeDelta, { color: deltaColor }]}>
              {formatCount(delta)}
            </Text>
            <Text style={[styles.running, modern && styles.arcadeRunning]}>
              {formatCount(running)}
            </Text>
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
  arcadeRow: {
    paddingVertical: spacing.xs,
  },
  column: {
    alignItems: 'center',
    gap: 1,
  },
  arcadeColumn: {
    gap: spacing.xxs,
  },
  arcadeDelta: {
    fontFamily: fonts.monoMedium,
    fontWeight: fontWeights.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  arcadeRunning: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.arcadeMuted,
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
