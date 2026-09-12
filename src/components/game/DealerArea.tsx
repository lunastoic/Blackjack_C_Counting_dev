import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoundState } from '../../engine/blackjack/round';
import { CardSkin } from '../../assets/cards.generated';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, spacing } from '../../theme';
import { arcadeShadow } from '../arcade';
import { HandView } from './HandView';

interface DealerAreaProps {
  readonly round: Pick<RoundState, 'dealerHand'> | null;
  readonly dealerCardWidth: number;
  readonly skin: CardSkin;
  readonly underglow: boolean;
  readonly speed: number;
  readonly maxVisibleCards?: number;
  readonly areaLabel: string;
  /** Copy shown while no hand is on the felt. */
  readonly emptyLabel?: string;
  /** Print each face-up card's Hi-Lo value beneath it. */
  readonly valueTags?: boolean;
  /** Side-by-side with a small gap instead of the overlapping fan. */
  readonly spacedCards?: boolean;
  /** Side-by-side this far apart; see HandView. */
  readonly cardGap?: number;
  readonly maxWidth?: number;
}

/** Centered dealer hand below the piles / stats row. */
export function DealerArea({
  round,
  dealerCardWidth,
  skin,
  underglow,
  speed,
  maxVisibleCards,
  areaLabel,
  emptyLabel = 'Place your bet',
  valueTags = false,
  spacedCards = false,
  cardGap,
  maxWidth,
}: DealerAreaProps) {
  const modern = useModernUi();
  return (
    <View style={styles.area}>
      <Text style={[styles.areaLabel, modern && styles.areaLabelModern]}>
        {modern ? areaLabel.toUpperCase() : areaLabel}
      </Text>
      {round ? (
        <HandView
          hand={round.dealerHand}
          skin={skin}
          cardWidth={dealerCardWidth}
          underglow={underglow}
          hideDownCardsFromTotal
          speed={speed}
          maxVisibleCards={maxVisibleCards}
          valueTags={valueTags}
          spacedCards={spacedCards}
          cardGap={cardGap}
          maxWidth={maxWidth}
        />
      ) : (
        <View style={styles.emptyHand}>
          <Text style={[styles.emptyHandText, modern && styles.emptyHandTextModern]}>
            {emptyLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  areaLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  emptyHand: {
    height: 104,
    justifyContent: 'center',
  },
  emptyHandText: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontStyle: 'italic',
  },
  /* Modern */
  areaLabelModern: {
    fontFamily: fonts.display,
    fontWeight: undefined,
    fontSize: 18,
    lineHeight: 19,
    letterSpacing: 3,
    color: colors.arcadeCream,
    opacity: 0.8,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  emptyHandTextModern: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.arcadeMuted,
  },
});
