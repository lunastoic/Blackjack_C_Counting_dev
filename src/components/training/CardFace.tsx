import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { CARD_FACES } from '../../assets/cards.generated';
import { Card } from '../../engine/cards/card';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors } from '../../theme';
import { CARD_ASPECT, cardCornerRadius } from '../game/PlayingCard';

interface CardFaceProps {
  readonly card: Card;
  readonly width: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * A card face that just sits there — no deal-in from the shoe, no flip. For
 * the boards and drops that move cards themselves (Cancel Out, Card Rain).
 * Follows the Card deck setting like the table's cards.
 */
export function CardFace({ card, width, style }: CardFaceProps) {
  const cardDeck = useSettingsStore((state) => state.cardDeck);
  const radius = cardCornerRadius(width);
  return (
    <View
      style={[
        styles.card,
        { width, height: Math.round(width / CARD_ASPECT), borderRadius: radius },
        style,
      ]}
    >
      <Image
        source={CARD_FACES[cardDeck][card.suit][card.rank]}
        style={[styles.image, { borderRadius: radius }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.arcadeCream,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
