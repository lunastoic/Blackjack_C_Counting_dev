import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RANKS } from '../../engine/cards/card';
import { remainingRankDistribution } from '../../engine/shoe/shoe';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { ModalSheet } from '../common/ModalSheet';

/** Optional training aid: dealt-versus-remaining bars per rank for the live shoe. */
export function DistributionChartModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const shoe = useGameSessionStore((state) => state.shoe);

  return (
    <ModalSheet visible={visible} title="Card Distribution" onClose={onClose}>
      {shoe ? (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.legendText}>Remaining</Text>
            <View style={[styles.legendSwatch, { backgroundColor: colors.surfaceRaised }]} />
            <Text style={styles.legendText}>Dealt</Text>
          </View>
          {RANKS.map((rank) => {
            const remaining = remainingRankDistribution(shoe)[rank];
            const total = shoe.deckCount * 4;
            const dealt = total - remaining;
            return (
              <View key={rank} style={styles.row}>
                <Text style={styles.rankLabel}>{rank}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { flex: remaining }]} />
                  <View style={{ flex: dealt }} />
                </View>
                <Text style={styles.counts}>
                  {remaining}/{total}
                </Text>
              </View>
            );
          })}
          <Text style={styles.footnote}>
            Counts update as cards are dealt and reset when the shoe is shuffled.
          </Text>
        </ScrollView>
      ) : null}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 480,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    marginRight: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rankLabel: {
    width: 26,
    color: colors.textPrimary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    height: 12,
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
  },
  counts: {
    width: 48,
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
