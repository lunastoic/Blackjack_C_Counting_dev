import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cardsDealt } from '../../engine/shoe/shoe';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';

/**
 * Regular Mode near-deck strip (REBUILD_SPEC §11): cards dealt, cards
 * remaining, and max bet — NEVER the count.
 */
export function RegularInfoBar() {
  const shoe = useGameSessionStore((state) => state.shoe);
  const map = useGameSessionStore((state) => state.map);
  const remaining = useGameSessionStore((state) => state.getCardsRemainingVisible());
  const shufflePending = useGameSessionStore((state) => state.shufflePending);
  const justShuffled = useGameSessionStore((state) => state.justShuffled);

  const dealt = shoe ? cardsDealt(shoe) : 0;

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
          <Text style={styles.statLabel}>MAX BET</Text>
          <Text style={styles.statValue}>{map ? formatChips(map.maxBet) : '—'}</Text>
        </View>
      </View>
      {justShuffled ? (
        <Text style={styles.shuffleNotice}>Deck shuffled</Text>
      ) : shufflePending ? (
        <Text style={styles.shuffleWarning}>Shuffling deck after this round</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.overlayLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.sm,
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
