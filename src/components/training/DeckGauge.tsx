import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CARD_BACK } from '../../assets/cards.generated';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import { colors, fontWeights, radii } from '../../theme';
import { CARD_ASPECT } from '../game/PlayingCard';

const TRAY_HEIGHT = 112;
const TRAY_WIDTH = 40;
/** Card-edge stripes down the stack, one every few pixels. */
const STRIPE_PITCH = 4;

interface DeckGaugeProps {
  readonly variant: 'shoe' | 'discard';
  /** Cards in this pile. */
  readonly count: number;
  /** Cards the whole shoe started with — sets the scale. */
  readonly totalCards: number;
  /** Faint tick per deck — the crutch the deck-estimation ladder takes away. */
  readonly showScale: boolean;
  readonly label?: string;
}

/**
 * A pile of cards drawn to scale: the height of the stack is proportional to
 * the number of cards in it, exactly what a counter reads off the discard
 * tray to estimate the decks left. Never prints a number.
 */
export function DeckGauge({ variant, count, totalCards, showScale, label }: DeckGaugeProps) {
  const fraction = totalCards > 0 ? Math.max(0, Math.min(1, count / totalCards)) : 0;
  const stack = count > 0 ? Math.max(3, Math.round(fraction * TRAY_HEIGHT)) : 0;
  const stripes = Math.max(0, Math.floor(stack / STRIPE_PITCH) - 1);
  const decks = Math.floor(totalCards / CARDS_PER_DECK);
  const ticks = showScale
    ? Array.from({ length: Math.max(0, decks - 1) }, (_, index) => (index + 1) / decks)
    : [];
  const backHeight = Math.round(TRAY_WIDTH / CARD_ASPECT) * 0.18;

  return (
    <View
      style={styles.column}
      accessibilityLabel={`${label ?? variant} pile, ${Math.round(fraction * 100)} percent full`}
    >
      <View style={styles.tray}>
        {ticks.map((tick) => (
          <View key={tick} style={[styles.tick, { bottom: Math.round(tick * TRAY_HEIGHT) }]} />
        ))}
        {stack > 0 ? (
          <View style={[styles.stack, { height: stack }]}>
            {Array.from({ length: stripes }, (_, index) => (
              <View key={index} style={[styles.stripe, { bottom: (index + 1) * STRIPE_PITCH }]} />
            ))}
            <Image
              source={CARD_BACK}
              style={[styles.back, { height: backHeight }]}
              resizeMode="cover"
            />
          </View>
        ) : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: 4,
  },
  tray: {
    width: TRAY_WIDTH,
    height: TRAY_HEIGHT,
    justifyContent: 'flex-end',
    borderBottomWidth: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderGold,
    borderBottomLeftRadius: radii.xs,
    borderBottomRightRadius: radii.xs,
    backgroundColor: colors.overlayLight,
  },
  tick: {
    position: 'absolute',
    left: -5,
    width: 5,
    height: 1,
    backgroundColor: colors.goldDim,
  },
  stack: {
    width: '100%',
    backgroundColor: colors.textPrimary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderSubtle,
    opacity: 0.6,
  },
  back: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
});
