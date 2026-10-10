import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { decisionLabel, StrategyItem } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { PlayingCard } from '../game/PlayingCard';

interface StrategyStageProps {
  readonly item: StrategyItem;
  readonly cardWidth: number;
  readonly speed: number;
  /** Show the book play and why (after an answer). */
  readonly reveal: boolean;
  readonly serial: number;
  /** "NICE! NOW SOFT HANDS" on the first hand of a new stage. */
  readonly banner?: string | null;
}

/** Basic strategy: the dealer's card over the player's two cards, and the book play once answered. */
export function StrategyStage({ item, cardWidth, speed, reveal, serial, banner }: StrategyStageProps) {
  return (
    <View key={serial} style={styles.stage}>
      {banner ? <Text style={styles.banner}>{banner}</Text> : null}
      <Text style={styles.label}>DEALER</Text>
      <PlayingCard card={item.dealerUp} skin="regular" width={cardWidth} underglow={false} speed={speed} />
      <View style={styles.hand}>
        {item.playerCards.map((card, index) => (
          <View key={card.id} style={index > 0 ? styles.overlap : undefined}>
            <PlayingCard card={card} skin="regular" width={cardWidth} underglow={false} speed={speed} />
          </View>
        ))}
      </View>
      <View style={styles.tag}>
        <Text style={styles.tagText}>{item.label.toUpperCase()}</Text>
      </View>
      <Text style={styles.reveal}>
        {reveal ? `${decisionLabel(item.correct)}. ${item.reason.replace(/^[A-Za-z]+ — /, '')}` : ' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  banner: {
    color: colors.arcadeInk,
    backgroundColor: colors.arcadeMint,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
  hand: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  overlap: {
    marginLeft: -spacing.lg,
  },
  tag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlayLight,
  },
  tagText: {
    color: colors.goldBright,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
  },
  reveal: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
