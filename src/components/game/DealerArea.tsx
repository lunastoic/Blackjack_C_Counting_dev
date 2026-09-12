import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoundState } from '../../engine/blackjack/round';
import { CardSkin } from '../../assets/cards.generated';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, spacing } from '../../theme';
import { ArcadeTag, arcadeShadow } from '../arcade';
import { HandView, shownTotal } from './HandView';

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

/** The Modern label's line height; the total tag is centred on it. */
const MODERN_LABEL_LINE = 19;
/** The tag's full height, bevel drop included: it overhangs the label line top and bottom. */
const MODERN_TAG_HEIGHT = 33;

/**
 * Centered dealer hand below the piles / stats row. In Modern the dealer's
 * total hangs off the right of the DEALER label instead of under the cards,
 * so the hand sits higher and the open felt beneath it runs deeper.
 */
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
  const labelTotal =
    modern && round
      ? shownTotal(round.dealerHand, { hideDownCards: true, maxVisibleCards })
      : null;
  return (
    <View style={[styles.area, modern && styles.areaModern]}>
      {modern ? (
        <View style={styles.labelLineModern}>
          <Text style={[styles.areaLabel, styles.areaLabelModern]}>{areaLabel.toUpperCase()}</Text>
          {/* A widthless slot after the label: the tag hangs out of it, so the
              label stays centred on the table's axis. */}
          <View style={styles.labelTagSlotModern}>
            {labelTotal !== null ? (
              <ArcadeTag label={String(labelTotal)} style={styles.labelTagModern} />
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={styles.areaLabel}>{areaLabel}</Text>
      )}
      {round ? (
        <HandView
          hand={round.dealerHand}
          skin={skin}
          cardWidth={dealerCardWidth}
          underglow={underglow}
          hideDownCardsFromTotal
          showTotal={!modern}
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
  /** Right under the piles; the gap clears the tag's overhang above the cards. */
  areaModern: {
    paddingTop: 0,
    gap: spacing.md,
  },
  /** The label centred on the table's axis; the total hangs off its right and never shifts it. */
  labelLineModern: {
    flexDirection: 'row',
    height: MODERN_LABEL_LINE,
    alignItems: 'center',
  },
  labelTagSlotModern: {
    width: 0,
    height: MODERN_LABEL_LINE,
  },
  labelTagModern: {
    position: 'absolute',
    top: (MODERN_LABEL_LINE - MODERN_TAG_HEIGHT) / 2,
    left: spacing.sm,
  },
  areaLabelModern: {
    fontFamily: fonts.display,
    fontWeight: undefined,
    fontSize: 18,
    lineHeight: MODERN_LABEL_LINE,
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
