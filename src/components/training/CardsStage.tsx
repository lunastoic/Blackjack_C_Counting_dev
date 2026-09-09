import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Card, hiLoValue, withVisibility } from '../../engine/cards/card';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { PlayingCard } from '../game/PlayingCard';

interface CardsStageProps {
  readonly cards: readonly Card[];
  readonly cardWidth: number;
  /** Deal-in animation multiplier from the speed preset. */
  readonly speed: number;
  /** Print each card's Hi-Lo value beneath it — the answer, so only after one. */
  readonly valueTags: boolean;
  /** Bumps per item so identical cards still re-deal. */
  readonly serial: number;
  readonly caption?: string;
  /** The answer just given was wrong: the cards rattle like a locked map's lock. */
  readonly missed?: boolean;
}

/** A group of face-up cards side by side — the streak drills' whole table. */
export function CardsStage({ cards, cardWidth, speed, valueTags, serial, caption, missed = false }: CardsStageProps) {
  const reducedMotion = useReducedMotion();
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  useEffect(() => {
    if (!missed || reducedMotion) {
      return;
    }
    shakeX.set(
      withSequence(
        withTiming(-10, { duration: 55 }),
        withTiming(10, { duration: 70 }),
        withTiming(-7, { duration: 70 }),
        withTiming(7, { duration: 70 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      ),
    );
  }, [missed, reducedMotion, shakeX]);

  return (
    <View style={styles.stage}>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Animated.View key={serial} style={[styles.row, shakeStyle]}>
        {cards.map((card, index) => {
          const value = hiLoValue(card.rank);
          const tagColor =
            value > 0 ? colors.trainingPlus : value < 0 ? colors.trainingMinus : colors.trainingNeutral;
          return (
            <View key={card.id} style={styles.column}>
              <PlayingCard
                card={withVisibility(card, 'faceUp')}
                skin="regular"
                width={cardWidth}
                underglow={false}
                speed={speed}
                enterDelay={index * 70}
              />
              <Text
                style={[
                  styles.valueTag,
                  { color: tagColor, borderColor: tagColor },
                  !valueTags && styles.valueTagHidden,
                ]}
                accessibilityElementsHidden={!valueTags}
              >
                {formatCount(value)}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  column: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  valueTag: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.overlayLight,
    overflow: 'hidden',
  },
  valueTagHidden: {
    opacity: 0,
  },
});
