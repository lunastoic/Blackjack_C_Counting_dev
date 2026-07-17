import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  cardsDealt,
  cutCardDealtCount,
  shuffleThreshold,
  totalCards,
} from '../../engine/shoe/shoe';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';

/**
 * Near-deck strip while the Count Coach is Off or Learn: shoe progress and
 * max bet — NEVER the count (live counts live in CountStatsBar on Full).
 */
export function RegularInfoBar() {
  const shoe = useGameSessionStore((state) => state.shoe);
  const map = useGameSessionStore((state) => state.map);
  const remaining = useGameSessionStore((state) => state.getCardsRemainingVisible());
  const shufflePending = useGameSessionStore((state) => state.shufflePending);
  const justShuffled = useGameSessionStore((state) => state.justShuffled);

  const dealt = shoe ? cardsDealt(shoe) : 0;
  const total = shoe ? totalCards(shoe.deckCount) : 0;
  const cutAt = shoe ? cutCardDealtCount(shoe.deckCount) : 0;
  const unusedAtCut = shoe ? shuffleThreshold(shoe.deckCount) : 0;
  const percentToCut =
    cutAt > 0 ? Math.min(100, Math.round((dealt / cutAt) * 100)) : 0;
  const decksLeftApprox =
    shoe && remaining > 0 ? (remaining / 52).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>DEALT</Text>
          <Text style={styles.statValue}>{dealt}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>REMAINING</Text>
          <Text style={styles.statValue}>{remaining}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>TO CUT</Text>
          <Text style={styles.statValue}>{percentToCut}%</Text>
        </View>
      </View>
      {shoe ? (
        <View style={styles.shoeMeta}>
          <Text style={styles.metaText}>
            Cut ~{cutAt}/{total} · ~{unusedAtCut} unused · ~{decksLeftApprox} decks left
          </Text>
          <Text style={styles.metaText}>Max {map ? formatChips(map.maxBet) : '—'}</Text>
        </View>
      ) : null}
      {justShuffled ? (
        <Text style={styles.shuffleNotice}>Deck shuffled — count reset to 0</Text>
      ) : shufflePending ? (
        <Text style={styles.shuffleWarning}>Shuffling deck after this round</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.overlayLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.sm,
    minWidth: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  shoeMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.semibold,
  },
  shuffleWarning: {
    color: colors.warning,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  shuffleNotice: {
    color: colors.success,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
});
