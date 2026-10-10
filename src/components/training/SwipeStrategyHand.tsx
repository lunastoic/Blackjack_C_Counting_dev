import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StrategyItem, SWIPE_THRESHOLD, SwipeDirection, swipeFromDrag } from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fonts, spacing } from '../../theme';
import { CardFace } from './CardFace';

interface SwipeStrategyHandProps {
  readonly item: StrategyItem;
  /** Bumps with every new hand: the card slides in fresh. */
  readonly serial: number;
  readonly cardWidth: number;
  readonly disabled: boolean;
  readonly onSwipe: (direction: SwipeDirection) => void;
}

/** How far the card flies off on a swipe before the next hand lands (px). */
const FLY_OFF = 420;

/**
 * The hand on the felt: the dealer's card above and the two-card hand on a
 * slab the player swipes. The slab follows the finger; let go past the
 * threshold and it flies off in that direction, otherwise it springs back.
 */
export function SwipeStrategyHand({ item, serial, cardWidth, disabled, onSwipe }: SwipeStrategyHandProps) {
  const reducedMotion = useReducedMotion();
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const enter = useSharedValue(reducedMotion ? 1 : 0);

  // A new hand slides in from the shoe side.
  useEffect(() => {
    dx.set(0);
    dy.set(0);
    if (reducedMotion) {
      enter.set(1);
      return;
    }
    enter.set(0);
    enter.set(withTiming(1, { duration: 220 }));
  }, [serial, reducedMotion, dx, dy, enter]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      dx.set(event.translationX);
      dy.set(event.translationY);
    })
    .onEnd((event) => {
      const ax = Math.abs(event.translationX);
      const ay = Math.abs(event.translationY);
      if (Math.max(ax, ay) >= SWIPE_THRESHOLD) {
        if (ax >= ay) {
          dx.set(withTiming(Math.sign(event.translationX) * FLY_OFF, { duration: 160 }));
        } else {
          dy.set(withTiming(Math.sign(event.translationY) * FLY_OFF, { duration: 160 }));
        }
        runOnJS(release)(event.translationX, event.translationY);
        return;
      }
      dx.set(withSpring(0, { damping: 18, stiffness: 260 }));
      dy.set(withSpring(0, { damping: 18, stiffness: 260 }));
    });

  function release(moveX: number, moveY: number) {
    const direction = swipeFromDrag(moveX, moveY);
    if (direction) {
      onSwipe(direction);
    }
  }

  const slabStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateX: dx.value + (1 - enter.value) * 60 },
      { translateY: dy.value },
      { rotate: `${dx.value / 18}deg` },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.lbl}>DEALER</Text>
      <CardFace card={item.dealerUp} width={cardWidth} />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.slab, slabStyle]}
          accessible
          accessibilityLabel={`${item.label} against the dealer's ${item.dealerUp.rank}. Swipe left to hit, right to stand, up to double, down to split.`}
        >
          <View style={styles.row}>
            {item.playerCards.map((card, index) => (
              <CardFace key={`${card.id}-${index}`} card={card} width={cardWidth} />
            ))}
          </View>
          <Text style={styles.tag}>{item.label.toUpperCase()}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  lbl: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 3,
  },
  slab: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(242, 196, 69, 0.6)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tag: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.arcadeGold,
  },
});
