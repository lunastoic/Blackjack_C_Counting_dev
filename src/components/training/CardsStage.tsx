import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, hiLoValue, withVisibility } from '../../engine/cards/card';
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
}

/** A group of face-up cards side by side — the streak drills' whole table. */
export function CardsStage({ cards, cardWidth, speed, valueTags, serial, caption }: CardsStageProps) {
  return (
    <View style={styles.stage}>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View key={serial} style={styles.row}>
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
      </View>
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
