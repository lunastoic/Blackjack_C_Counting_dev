import { Image } from 'expo-image';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { useSettingsStore } from '../../stores/settingsStore';
import { colors, durations, radii } from '../../theme';

/** Aspect ratio of the migrated card art (500×700). */
export const CARD_ASPECT = 500 / 700;

/** Underglow ring drawn around the face; the face sits fully inside it. */
const RING_WIDTH = 2;

/**
 * Corner radius that tracks the art instead of a fixed 8pt: the faces keep
 * their indices ~4% of the width from the edge, so a fixed radius on a small
 * card (drill rows run down to 26pt) would clip the corner of the index.
 */
export function cardCornerRadius(width: number): number {
  return Math.min(radii.sm, Math.round(width / 12));
}

/**
 * Outer height of a card frame whose art sits inside a `ring`-wide border:
 * the box inside the ring keeps the exact art aspect, so `cover` never crops.
 */
export function cardFrameHeight(width: number, ring: number): number {
  return (width - ring * 2) / CARD_ASPECT + ring * 2;
}

interface PlayingCardProps {
  readonly card: Card;
  /**
   * `regular` means "the player's plain deck" and follows the Card deck
   * setting; `training` (coach-annotated faces) and an explicit `luna` do not.
   */
  readonly skin: CardSkin;
  readonly width: number;
  /** Training-mode Hi-Lo underglow (green +1 / gray 0 / red −1) on face-up cards. */
  readonly underglow: boolean;
  /** Stagger delay for the deal-in animation (ms). */
  readonly enterDelay?: number;
  /** Multiplier from the dealer-speed setting (higher = faster). */
  readonly speed?: number;
  /** False = colored border only, no radiating shadow (for overlapped cards). */
  readonly glowHalo?: boolean;
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
  glowHalo = true,
}: PlayingCardProps) {
  const reducedMotion = useReducedMotion();
  const cardDeck = useSettingsStore((state) => state.cardDeck);
  const face = CARD_FACES[skin === 'regular' ? cardDeck : skin][card.suit][card.rank];
  const faceUp = isFaceUp(card);
  // 0 = back showing, 1 = face showing.
  const flip = useSharedValue(faceUp ? 1 : 0);
  const dealtFaceDown = useSharedValue(faceUp ? 0 : 1);

  // The swish belongs to the card's own entrance, which the Keyframe below
  // holds back by enterDelay: a hand dealt together sounds card by card
  // instead of one swish for all of them on mount.
  useEffect(() => {
    const delay = reducedMotion ? 0 : enterDelay;
    if (delay <= 0) {
      playSound('cardDeal');
      return;
    }
    const timer = setTimeout(() => playSound('cardDeal'), delay);
    return () => clearTimeout(timer);
    // Once, on mount: the entrance itself never replays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The face inside the ring keeps the art's exact aspect, so `cover` never
  // crops a sliver off the edges.
  const faceWidth = width - RING_WIDTH * 2;
  const faceHeight = faceWidth / CARD_ASPECT;
  const height = cardFrameHeight(width, RING_WIDTH);
  const radius = cardCornerRadius(width);
  const showGlow = underglow && faceUp;
  const glow = showGlow ? glowColor(card) : 'transparent';

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      accessibilityLabel={faceUp ? cardLabel(card) : 'Face-down card'}
      style={[
        styles.container,
        { width, height, borderRadius: radius },
        showGlow && { borderColor: glow },
        showGlow &&
          glowHalo && {
            shadowColor: glow,
            shadowOpacity: 0.9,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          },
      ]}
    >
      <Animated.View style={[styles.face, { borderRadius: radius }, backStyle]}>
        <Image source={CARD_BACK} style={styles.image} contentFit="cover" />
      </Animated.View>
      <Animated.View style={[styles.face, { borderRadius: radius }, faceStyle]}>
        <Image source={face} style={styles.image} contentFit="cover" />
      </Animated.View>
      {/* Reserve layout size even while both faces are absolutely positioned. */}
      <View style={{ width: faceWidth, height: faceHeight }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: RING_WIDTH,
    borderColor: 'transparent',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
