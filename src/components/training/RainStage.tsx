import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Card } from '../../engine/cards/card';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { colors, fontWeights, spacing } from '../../theme';
import { CARD_ASPECT } from '../game/PlayingCard';
import { CardFace } from './CardFace';

interface RainStageProps {
  /** Cards since the last check, oldest first; the last one is falling now. */
  readonly cards: readonly Card[];
  /** Cards dealt so far this run. */
  readonly dealt: number;
  readonly cardWidth: number;
  /** Time each card has on the felt (ms) — the drop takes a share of it. */
  readonly cardMs: number;
}

/** Cards that stay visible on the pile under the falling one. */
const PILE = 4;
/** Room either side of the pile for the cards' sideways scatter. */
const PILE_MARGIN = 20;
/** How far above its spot a card starts its fall. */
const DROP_FROM = 320;

/** A small, steady tilt per card so the pile looks dropped, not stacked. */
function tiltFor(card: Card): number {
  let hash = 0;
  for (const char of `${card.rank}${card.suit}${card.id}`) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return (hash % 17) - 8;
}

function shiftFor(card: Card): number {
  return ((tiltFor(card) * 7) % 23) - 11;
}

function FallingCard({ card, width, dropMs }: { card: Card; width: number; dropMs: number }) {
  const reducedMotion = useReducedMotion();
  const fall = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    playSound('cardDeal');
    if (reducedMotion) {
      fall.value = 1;
      return;
    }
    fall.value = withSequence(
      withTiming(1, { duration: dropMs, easing: Easing.in(Easing.quad) }),
      withTiming(0.97, { duration: 70 }),
      withTiming(1, { duration: 90 }),
    );
  }, [fall, dropMs, reducedMotion]);

  const tilt = tiltFor(card);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, fall.value * 3),
    transform: [
      { translateY: (1 - fall.value) * -DROP_FROM },
      { rotate: `${tilt * fall.value + (1 - fall.value) * tilt * 3}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.layer, { left: PILE_MARGIN + shiftFor(card) }, style]}>
      <CardFace card={card} width={width} />
    </Animated.View>
  );
}

/**
 * Card Rain: each card falls from the top of the felt onto a loose pile. The
 * pile clears at every check, so the trainee holds the count, not the cards.
 */
export function RainStage({ cards, dealt, cardWidth, cardMs }: RainStageProps) {
  const height = Math.round(cardWidth / CARD_ASPECT);
  const pile = cards.slice(-PILE);
  const falling = pile.length > 0 ? pile[pile.length - 1] : null;
  const resting = pile.slice(0, -1);
  const dropMs = Math.max(220, Math.round(cardMs * 0.45));

  return (
    <View style={styles.stage} pointerEvents="none">
      <View style={[styles.pile, { width: cardWidth + PILE_MARGIN * 2, height: height + 20 }]}>
        {resting.map((card, index) => (
          <View
            key={`${card.id}-${index}`}
            style={[
              styles.layer,
              {
                left: PILE_MARGIN + shiftFor(card),
                opacity: 0.45 + (index / PILE) * 0.4,
                transform: [{ rotate: `${tiltFor(card)}deg` }],
              },
            ]}
          >
            <CardFace card={card} width={cardWidth} />
          </View>
        ))}
        {falling ? (
          <FallingCard key={`${falling.id}-${dealt}`} card={falling} width={cardWidth} dropMs={dropMs} />
        ) : null}
      </View>
      <Text style={styles.caption}>{dealt > 0 ? `CARD ${dealt}` : ' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    overflow: 'visible',
  },
  pile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    top: 10,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
