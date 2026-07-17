import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CARD_BACK } from '../../assets/cards.generated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { layers, radii, durations } from '../../theme';
import { CARD_ASPECT } from './PlayingCard';

/** Wall-clock length of the shuffle ceremony (not scaled by dealer speed). */
export const SHUFFLE_ANIMATION_MS = durations.shoeShuffle;

const CARD_W = 44;
const CARD_H = CARD_W / CARD_ASPECT;
const FLYER_COUNT = 10;

interface ShuffleCeremonyProps {
  readonly active: boolean;
}

/**
 * Physical shuffle: cards lift from discard (left) and shoe (right), wash in
 * the center for ~2s, then settle onto the deck pile on the right.
 */
export function ShuffleCeremony({ active }: ShuffleCeremonyProps) {
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: SHUFFLE_ANIMATION_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [active, reducedMotion, progress]);

  if (!active) {
    return null;
  }

  const discardX = 28;
  const deckX = width - 28 - CARD_W;
  const centerX = width / 2 - CARD_W / 2;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {Array.from({ length: FLYER_COUNT }, (_, index) => (
        <ShuffleFlyer
          key={index}
          index={index}
          progress={progress}
          discardX={discardX}
          deckX={deckX}
          centerX={centerX}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
}

function ShuffleFlyer({
  index,
  progress,
  discardX,
  deckX,
  centerX,
  reducedMotion,
}: {
  index: number;
  progress: SharedValue<number>;
  discardX: number;
  deckX: number;
  centerX: number;
  reducedMotion: boolean;
}) {
  const fromDiscard = index % 2 === 0;
  const startX = fromDiscard ? discardX : deckX;
  const startY = 8 + (index % 5) * 3;
  const weave = ((index % 5) - 2) * 14;
  const rot = ((index % 4) - 1.5) * 8;

  const style = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: 0,
        transform: [{ translateX: deckX }, { translateY: 20 }, { rotate: '0deg' }],
      };
    }

    const p = progress.value;
    let x = startX;
    let y = startY;
    let r = fromDiscard ? -6 : 4;

    if (p < 0.22) {
      const t = p / 0.22;
      x = startX + (centerX + weave - startX) * t;
      y = startY + (36 + (index % 3) * 4 - startY) * t;
      r = r + (rot - r) * t;
    } else if (p < 0.78) {
      const t = (p - 0.22) / 0.56;
      const bob = Math.sin(t * Math.PI * 6 + index) * 10;
      const sway = Math.sin(t * Math.PI * 5 + index * 0.7) * 18;
      x = centerX + weave * (1 - t * 0.35) + sway;
      y = 40 + bob + (index % 3) * 2;
      r = rot * Math.cos(t * Math.PI * 4);
    } else {
      const t = (p - 0.78) / 0.22;
      const ease = t * t * (3 - 2 * t);
      const washX = centerX + weave * 0.65;
      const washY = 40;
      x = washX + (deckX - washX) * ease;
      y = washY + (12 + (index % 3) * 2 - washY) * ease;
      r = rot * (1 - ease);
    }

    return {
      opacity: 1,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${r}deg` }],
      zIndex: index,
    };
  });

  return (
    <Animated.Image
      source={CARD_BACK}
      style={[styles.card, style]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: layers.raised + 5,
    overflow: 'visible',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_W,
    height: CARD_H,
    borderRadius: radii.xs,
  },
});
