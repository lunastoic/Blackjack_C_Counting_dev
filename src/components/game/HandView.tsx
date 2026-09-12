import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { evaluateCards } from '../../engine/hand/evaluate';
import { Hand } from '../../engine/hand/hand';
import { Card, hiLoValue, isFaceUp } from '../../engine/cards/card';
import { CardSkin } from '../../assets/cards.generated';
import { useModernUi } from '../../hooks/useModernUi';
import { cardFanOverlap, cardRowStep } from '../../utils/dealSequence';
import { colors, fonts, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { ArcadeTag } from '../arcade';
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
  /** Print each face-up card's Hi-Lo value beneath it (Count Flash level 1). */
  readonly valueTags?: boolean;
  /** Side-by-side with a small gap instead of the overlapping fan. */
  readonly spacedCards?: boolean;
  /**
   * Side-by-side this far apart, and never a fan: the row only tucks in when
   * it would run past `maxWidth`, and then just enough to fit.
   */
  readonly cardGap?: number;
  /** Room the row has before it must tuck in (only read with `cardGap`). */
  readonly maxWidth?: number;
  /** Passed to each card: false = border glow only, no radiating halo. */
  readonly glowHalo?: boolean;
  /** Print the total under the cards; off when the caller shows it elsewhere. */
  readonly showTotal?: boolean;
}

/** The cards on the felt right now: the opening deal lays them down one at a time. */
export function dealtCards(hand: Hand, maxVisibleCards?: number): readonly Card[] {
  return maxVisibleCards !== undefined
    ? hand.cards.slice(0, Math.max(0, maxVisibleCards))
    : hand.cards;
}

/**
 * The total the table shows for a hand — of every dealt card, or of the
 * face-up ones only (the dealer with a hole card shows the upcard's value).
 * Null while no card counts.
 */
export function shownTotal(
  hand: Hand,
  { hideDownCards = false, maxVisibleCards }: { hideDownCards?: boolean; maxVisibleCards?: number },
): number | null {
  const cards = dealtCards(hand, maxVisibleCards);
  const counted = hideDownCards ? cards.filter((card) => isFaceUp(card)) : cards;
  return counted.length > 0 ? evaluateCards(counted).total : null;
}

/** A hand of cards — a gapped row or an overlapping fan — with an automatic total badge. */
export function HandView({
  hand,
  skin,
  cardWidth,
  underglow,
  hideDownCardsFromTotal = false,
  speed = 1,
  staggerMs = 90,
  maxVisibleCards,
  valueTags = false,
  spacedCards = false,
  cardGap,
  maxWidth,
  glowHalo = true,
  showTotal = true,
}: HandViewProps) {
  const modern = useModernUi();
  const displayedCards = dealtCards(hand, maxVisibleCards);
  const total = showTotal
    ? shownTotal(hand, { hideDownCards: hideDownCardsFromTotal, maxVisibleCards })
    : null;
  const count = displayedCards.length;
  // A spread hand collapses back to the fan once hits arrive, or it overflows.
  const useSpread = spacedCards && count <= 3;
  const step =
    cardGap !== undefined
      ? cardRowStep(cardWidth, count, cardGap, maxWidth)
      : useSpread
        ? cardWidth + spacing.md
        : cardWidth - cardFanOverlap(cardWidth, count);

  return (
    <View style={[styles.container, modern && styles.containerModern]}>
      <View style={styles.cards}>
        {displayedCards.map((card, index) => {
          const value = hiLoValue(card.rank);
          const tagColor = modern
            ? value > 0
              ? colors.arcadeMint
              : value < 0
                ? colors.arcadeLoss
                : colors.arcadeCream
            : value > 0
              ? colors.trainingPlus
              : value < 0
                ? colors.trainingMinus
                : colors.trainingNeutral;
          return (
            <View
              key={card.id}
              style={[styles.column, index > 0 ? { marginLeft: step - cardWidth } : null]}
            >
              <PlayingCard
                card={card}
                skin={skin}
                width={cardWidth}
                underglow={underglow}
                speed={speed}
                enterDelay={maxVisibleCards !== undefined ? 0 : index * staggerMs}
                glowHalo={glowHalo}
              />
              {valueTags ? (
                <Text
                  style={[
                    styles.valueTag,
                    modern && styles.valueTagModern,
                    { color: tagColor, borderColor: tagColor },
                    !isFaceUp(card) && styles.valueTagHidden,
                  ]}
                  accessibilityElementsHidden={!isFaceUp(card)}
                >
                  {formatCount(value)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {total !== null ? (
        modern ? (
          <ArcadeTag label={String(total)} />
        ) : (
          <View style={styles.totalBadge}>
            <Text style={styles.totalText}>{total}</Text>
          </View>
        )
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
    alignItems: 'flex-start',
  },
  column: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  valueTag: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.overlayLight,
    overflow: 'hidden',
  },
  valueTagHidden: {
    opacity: 0,
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
  /* Modern */
  containerModern: {
    gap: spacing.sm - 2,
  },
  valueTagModern: {
    fontFamily: fonts.monoMedium,
    fontWeight: undefined,
    fontSize: fontSizes.caption,
    borderWidth: 2,
    backgroundColor: colors.arcadeStripFace,
  },
});
