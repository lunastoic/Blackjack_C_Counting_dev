import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { CARD_BACK } from '../../assets/cards.generated';
import { radii } from '../../theme';
import { CARD_ASPECT } from './PlayingCard';

const X_JITTER = [0, 0.6, -0.6, 0.9, -0.9, 0.4, -0.4];
const DISCARD_MAX_LAYERS = 8;

interface CardStackProps {
  readonly variant: 'shoe' | 'discard';
  readonly count: number;
  readonly totalCards: number;
  readonly cardWidth: number;
}

/** Visible stack depth for the discard pile — scales with cards discarded. */
function discardLayers(count: number): number {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 1;
  }
  if (count <= 4) {
    return 2;
  }
  if (count <= 12) {
    return 3;
  }
  if (count <= 24) {
    return 4;
  }
  return Math.min(DISCARD_MAX_LAYERS, Math.ceil(count / 8));
}

/**
 * Shoe (right) = one card back. Discard (left) = stacked backs that grow as
 * cards are collected after each round.
 */
export function CardStack({ variant, count, cardWidth }: CardStackProps) {
  const layers = useMemo(() => {
    if (count <= 0) {
      return 0;
    }
    return variant === 'shoe' ? 1 : discardLayers(count);
  }, [count, variant]);

  const cardHeight = cardWidth / CARD_ASPECT;
  const rise = 3;
  const stackHeight = layers > 0 ? cardHeight + (layers - 1) * rise : cardHeight;
  const tilt = variant === 'shoe' ? '2deg' : '-3deg';

  if (count <= 0) {
    return (
      <View
        style={[
          styles.emptySlot,
          {
            width: cardWidth,
            height: cardHeight,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={{
        width: cardWidth + 8,
        height: stackHeight,
        overflow: 'visible',
      }}
      accessibilityLabel={
        variant === 'shoe' ? `Shoe, ${count} cards remaining` : `Discard pile, ${count} cards`
      }
    >
      {Array.from({ length: layers }, (_, index) => (
        <Image
          key={`${variant}-${index}`}
          source={CARD_BACK}
          style={{
            position: 'absolute',
            bottom: index * rise,
            left: 4 + (X_JITTER[index % X_JITTER.length] ?? 0),
            width: cardWidth,
            height: cardHeight,
            borderRadius: radii.xs,
            zIndex: index,
            transform: [{ rotate: tilt }],
          }}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptySlot: {
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
});
