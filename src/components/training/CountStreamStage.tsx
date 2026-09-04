import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StreamFrame } from '../../engine/dojo';
import { colors, fontWeights, spacing } from '../../theme';
import { CARD_ASPECT, PlayingCard } from '../game/PlayingCard';
import { DeckGauge } from './DeckGauge';

interface CountStreamStageProps {
  readonly frame: StreamFrame | null;
  /** Cards the shoe started with. */
  readonly totalCards: number;
  readonly cardWidth: number;
  readonly speed: number;
  /** Deck ticks on the piles. */
  readonly showScale: boolean;
  /** "CARD 17 OF 52" — hidden when the level asks for deck estimates. */
  readonly showProgress: boolean;
}

/**
 * One card at a time between the discard tray and the shoe. The running count
 * is never printed here; the piles are the only clue to how deep the deal is.
 */
export function CountStreamStage({
  frame,
  totalCards,
  cardWidth,
  speed,
  showScale,
  showProgress,
}: CountStreamStageProps) {
  const drawn = frame?.cardsDrawn ?? 0;
  const remaining = frame?.cardsRemaining ?? totalCards;
  const card = frame?.card ?? null;
  const cardHeight = Math.round(cardWidth / CARD_ASPECT);

  return (
    <View style={styles.stage}>
      <View style={styles.row}>
        <DeckGauge
          variant="discard"
          count={drawn}
          totalCards={totalCards}
          showScale={showScale}
          label="DISCARDS"
        />
        <View style={[styles.cardSlot, { width: cardWidth + spacing.lg, height: cardHeight + spacing.lg }]}>
          {card ? (
            <PlayingCard
              key={card.id}
              card={card}
              skin="regular"
              width={cardWidth}
              underglow={false}
              speed={speed}
            />
          ) : null}
        </View>
        <DeckGauge
          variant="shoe"
          count={remaining}
          totalCards={totalCards}
          showScale={showScale}
          label="SHOE"
        />
      </View>
      <Text style={styles.caption}>
        {showProgress && frame ? `CARD ${drawn} OF ${totalCards}` : ' '}
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  cardSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
