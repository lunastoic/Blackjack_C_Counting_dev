import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CARD_FACES } from '../../assets/cards.generated';
import { hiLoValue, Rank, Suit } from '../../engine/cards/card';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors, fonts, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { CARD_ASPECT, cardCornerRadius } from '../game/PlayingCard';

/** One card of each Hi-Lo value, fanned as the mock-up has them. */
const EXAMPLES: readonly { rank: Rank; suit: Suit; tilt: string; lift: number }[] = [
  { rank: '10', suit: 'spades', tilt: '-10deg', lift: 0 },
  { rank: '8', suit: 'hearts', tilt: '0deg', lift: -10 },
  { rank: '4', suit: 'clubs', tilt: '10deg', lift: 0 },
];

const VALUE_COLORS: Readonly<Record<number, string>> = {
  [-1]: colors.trainingMinus,
  0: colors.arcadeCream,
  1: colors.arcadeMint,
};

interface ExampleCardsProps {
  readonly cardWidth?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Three cards from the player's own deck, each with its Hi-Lo value under it —
 * the intro's picture of what the level asks. Real card art, never drawn.
 */
export function ExampleCards({ cardWidth = 60, style }: ExampleCardsProps) {
  const faces = CARD_FACES[useSettingsStore((state) => state.cardDeck)];
  const cardHeight = cardWidth / CARD_ASPECT;
  const radius = cardCornerRadius(cardWidth);

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.shadow, { height: cardHeight * 0.55 }]} />
      {EXAMPLES.map(({ rank, suit, tilt, lift }) => {
        const value = hiLoValue(rank);
        return (
          <View
            key={`${rank}${suit}`}
            style={[styles.slot, { transform: [{ translateY: lift }, { rotate: tilt }] }]}
          >
            <Image
              source={faces[suit][rank]}
              style={[styles.card, { width: cardWidth, height: cardHeight, borderRadius: radius }]}
              contentFit="cover"
              accessibilityLabel={`${rank} of ${suit}`}
            />
            <Text style={[styles.value, { color: VALUE_COLORS[value] }]}>
              {formatCount(value)}
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
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  /** The pool of shadow the fan sits in. */
  shadow: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.arcadeTileFill,
  },
  slot: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  card: {
    borderWidth: 2,
    borderColor: colors.arcadeInk,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 24,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
});
