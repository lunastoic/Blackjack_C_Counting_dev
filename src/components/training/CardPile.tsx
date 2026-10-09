import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCardBack } from '../../hooks/useCardBack';
import { colors, fontWeights } from '../../theme';
import { CARD_ASPECT, cardCornerRadius } from '../game/PlayingCard';

const PILE_CARD_WIDTH = 56;
/** How thick one card reads on the felt — a full deck stands about 21 px. */
const CARD_THICKNESS = 0.4;

interface CardPileProps {
  readonly variant: 'shoe' | 'discard';
  /** Cards in this pile. */
  readonly count: number;
  /** Cards the shoe started with — the tallest the pile can get. */
  readonly totalCards: number;
  readonly label?: string;
}

/**
 * A real pile of face-down cards lying on the felt: the top card's back,
 * and under it the stacked card edges, as thick as the pile is deep. The
 * shoe sits square; the discards lie a little askew, as a dealer drops them.
 * Never prints a number.
 */
export function CardPile({ variant, count, totalCards, label }: CardPileProps) {
  const cardBack = useCardBack();
  const cardHeight = Math.round(PILE_CARD_WIDTH / CARD_ASPECT);
  const radius = cardCornerRadius(PILE_CARD_WIDTH);
  const maxThickness = Math.round(totalCards * CARD_THICKNESS);
  const thickness = count > 0 ? Math.max(2, Math.round(count * CARD_THICKNESS)) : 0;
  // One edge line per couple of cards, so the side reads as a stack.
  const edges = Math.floor(thickness / 2);
  const tilt = variant === 'discard' ? '-4deg' : '0deg';

  return (
    <View
      style={styles.column}
      accessibilityLabel={`${label ?? variant}, ${count > 0 ? 'cards in the pile' : 'empty'}`}
    >
      {/* Fixed height: the pile shrinks or grows inside it, the row never moves. */}
      <View style={{ width: PILE_CARD_WIDTH + 8, height: cardHeight + maxThickness + 4 }}>
        {count > 0 ? (
          <View style={[styles.pile, { transform: [{ rotate: tilt }] }]}>
            <View
              style={[
                styles.edges,
                {
                  width: PILE_CARD_WIDTH,
                  height: thickness + radius,
                  borderBottomLeftRadius: radius,
                  borderBottomRightRadius: radius,
                },
              ]}
            >
              {Array.from({ length: edges }, (_, index) => (
                <View key={index} style={[styles.edgeLine, { bottom: 1 + index * 2 }]} />
              ))}
            </View>
            <Image
              source={cardBack}
              style={[
                styles.top,
                {
                  width: PILE_CARD_WIDTH,
                  height: cardHeight,
                  borderRadius: radius,
                  bottom: thickness,
                },
              ]}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : (
          <View
            style={[
              styles.spot,
              { width: PILE_CARD_WIDTH, height: cardHeight, borderRadius: radius },
            ]}
          />
        )}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: 6,
  },
  pile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  /** The side of the stack: cream card edges with fine lines between them. */
  edges: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#E9E1CC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.35)',
    overflow: 'hidden',
  },
  edgeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(90, 70, 40, 0.45)',
  },
  top: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.4)',
  },
  /** Where an empty pile would sit: a faint outline on the felt. */
  spot: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(242, 196, 69, 0.35)',
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
});
