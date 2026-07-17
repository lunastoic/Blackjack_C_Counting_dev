import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { evaluateCards } from '../../engine/hand/evaluate';
import { Hand } from '../../engine/hand/hand';
import { isFaceUp } from '../../engine/cards/card';
import { CardSkin } from '../../assets/cards.generated';
import { cardFanOverlap } from '../../utils/dealSequence';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { PlayingCard } from './PlayingCard';

interface HandViewProps {
  readonly hand: Hand;
  readonly skin: CardSkin;
  readonly cardWidth: number;
  readonly underglow: boolean;
  /** Show the total of face-up cards only (dealer with hidden hole shows upcard value). */
  readonly hideDownCardsFromTotal?: boolean;
  readonly speed?: number;
  /** Extra per-card entering stagger (ms) for hits after the opening deal. */
  readonly staggerMs?: number;
  /** During the opening deal, only this many cards are on the felt. */
  readonly maxVisibleCards?: number;
}

/** Overlapping card fan with an automatic total badge. */
export function HandView({
  hand,
  skin,
  cardWidth,
  underglow,
  hideDownCardsFromTotal = false,
  speed = 1,
  staggerMs = 90,
  maxVisibleCards,
}: HandViewProps) {
  const displayedCards =
    maxVisibleCards !== undefined
      ? hand.cards.slice(0, Math.max(0, maxVisibleCards))
      : hand.cards;

  const visibleCards = hideDownCardsFromTotal
    ? displayedCards.filter((card) => isFaceUp(card))
    : displayedCards;
  const { total } = evaluateCards(visibleCards);
  const overlap = cardFanOverlap(cardWidth, displayedCards.length);

  return (
    <View style={styles.container}>
      <View style={styles.cards}>
        {displayedCards.map((card, index) => (
          <View key={card.id} style={index > 0 ? { marginLeft: -overlap } : null}>
            <PlayingCard
              card={card}
              skin={skin}
              width={cardWidth}
              underglow={underglow}
              speed={speed}
              enterDelay={maxVisibleCards !== undefined ? 0 : index * staggerMs}
            />
          </View>
        ))}
      </View>
      {visibleCards.length > 0 ? (
        <View style={styles.totalBadge}>
          <Text style={styles.totalText}>{total}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  cards: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalBadge: {
    backgroundColor: colors.overlayLight,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  totalText: {
    color: colors.textPrimary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
});
