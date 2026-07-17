import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Keyframe,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Card, hiLoValue, cardLabel, isFaceUp } from '../../engine/cards/card';
import { CARD_BACK, CARD_FACES, CardSkin } from '../../assets/cards.generated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { colors, durations, radii } from '../../theme';

/** Aspect ratio of the migrated card art (500×700). */
export const CARD_ASPECT = 500 / 700;

interface PlayingCardProps {
  readonly card: Card;
  readonly skin: CardSkin;
  readonly width: number;
  /** Training-mode Hi-Lo underglow (green +1 / gray 0 / red −1) on face-up cards. */
  readonly underglow: boolean;
  /** Stagger delay for the deal-in animation (ms). */
  readonly enterDelay?: number;
  /** Multiplier from the dealer-speed setting (higher = faster). */
  readonly speed?: number;
}

function glowColor(card: Card): string {
  const value = hiLoValue(card.rank);
  if (value > 0) {
    return colors.trainingPlus;
  }
  if (value < 0) {
    return colors.trainingMinus;
  }
  return colors.trainingNeutral;
}

/**
 * One card on the table: slides in from the shoe (top right), flips from back
 * to face when its visibility changes (hole-card reveal), slides off when the
 * round is collected. All animation collapses under reduced motion.
 */
export function PlayingCard({
  card,
  skin,
  width,
  underglow,
  enterDelay = 0,
  speed = 1,
}: PlayingCardProps) {
  const reducedMotion = useReducedMotion();
  const faceUp = isFaceUp(card);
  // 0 = back showing, 1 = face showing.
  const flip = useSharedValue(faceUp ? 1 : 0);
  const dealtFaceDown = useSharedValue(faceUp ? 0 : 1);

  useEffect(() => {
    playSound('cardDeal');
    // Sound only; the visual entrance is the Keyframe below.
  }, []);

  useEffect(() => {
    const target = faceUp ? 1 : 0;
    if (faceUp && dealtFaceDown.value === 1) {
      playSound('cardFlip'); // hole-card reveal
      dealtFaceDown.value = 0;
    }
    flip.value = reducedMotion
      ? target
      : withTiming(target, { duration: durations.cardFlip / speed });
  }, [faceUp, reducedMotion, speed, flip, dealtFaceDown]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
  }));
  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  const entering = useMemo(() => {
    if (reducedMotion) {
      return undefined;
    }
    return new Keyframe({
      0: {
        opacity: 0,
        transform: [{ translateX: 110 }, { translateY: -130 }, { rotate: '14deg' }],
      },
      100: {
        opacity: 1,
        transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }],
      },
    })
      .duration(durations.cardTravel / speed)
      .delay(enterDelay);
  }, [reducedMotion, speed, enterDelay]);

  const exiting = useMemo(() => {
    if (reducedMotion) {
      return undefined;
    }
    return new Keyframe({
      0: {
        opacity: 1,
        transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }],
      },
      100: {
        opacity: 0,
        transform: [{ translateX: -100 }, { translateY: -90 }, { rotate: '-10deg' }],
      },
    }).duration(durations.slow / speed);
  }, [reducedMotion, speed]);

  const height = width / CARD_ASPECT;
  const showGlow = underglow && faceUp;
  const glow = showGlow ? glowColor(card) : 'transparent';

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      accessibilityLabel={faceUp ? cardLabel(card) : 'Face-down card'}
      style={[
        styles.container,
        { width, height },
        showGlow && {
          borderColor: glow,
          shadowColor: glow,
          shadowOpacity: 0.9,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        },
      ]}
    >
      <Animated.View style={[styles.face, backStyle]}>
        <Image source={CARD_BACK} style={styles.image} resizeMode="cover" />
      </Animated.View>
      <Animated.View style={[styles.face, faceStyle]}>
        <Image
          source={CARD_FACES[skin][card.suit][card.rank]}
          style={styles.image}
          resizeMode="cover"
        />
      </Animated.View>
      {/* Reserve layout size even while both faces are absolutely positioned. */}
      <View style={{ width, height }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
