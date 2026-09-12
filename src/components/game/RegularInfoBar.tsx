import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { maxBetForLicense } from '../../engine/betting/casino';
import {
  cardsDealt,
  cutCardDealtCount,
  shuffleThreshold,
  totalCards,
} from '../../engine/shoe/shoe';
import { useModernUi } from '../../hooks/useModernUi';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { colors, fonts, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { ArcadeStrip, ArcadeStripCell, ArcadeStripDivider } from '../arcade';

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
  const license = useProgressionStore((state) => (map ? state.licenseForMap(map.id) : 'none'));
  const betCap = map ? maxBetForLicense(map, license) : 0;

  const dealt = shoe ? cardsDealt(shoe) : 0;
  const total = shoe ? totalCards(shoe.deckCount) : 0;
  const cutAt = shoe ? cutCardDealtCount(shoe.deckCount) : 0;
  const unusedAtCut = shoe ? shuffleThreshold(shoe.deckCount) : 0;
  const percentToCut =
    cutAt > 0 ? Math.min(100, Math.round((dealt / cutAt) * 100)) : 0;
  const decksLeftApprox =
    shoe && remaining > 0 ? (remaining / 52).toFixed(1) : '0.0';
  const modern = useModernUi();

  if (modern) {
    const foot = justShuffled
      ? 'Deck shuffled — count reset to 0'
      : shufflePending
        ? 'Shuffling deck after this round'
        : shoe
          ? `Cut ~${cutAt}/${total} · ~${decksLeftApprox} decks left · Max ${map ? formatChips(betCap) : '—'}${license === 'permit' ? ' (permit)' : ''}`
          : '';
    const footColor = justShuffled
      ? colors.arcadeMint
      : shufflePending
        ? colors.arcadeLoss
        : colors.arcadeGold;
    return (
      <View style={styles.modernContainer}>
        <ArcadeStrip compact style={styles.modernStrip}>
          <ArcadeStripCell label="Dealt" value={dealt} compact />
          <ArcadeStripDivider />
          <ArcadeStripCell label="Remaining" value={remaining} compact />
          <ArcadeStripDivider />
          <ArcadeStripCell label="To cut" value={`${percentToCut}%`} compact />
        </ArcadeStrip>
        <View style={styles.modernFoot}>
          <Text style={[styles.modernFootText, { color: footColor }]} numberOfLines={2}>
            {foot}
          </Text>
        </View>
      </View>
    );
  }

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
          <Text style={styles.metaText}>
            Max {map ? formatChips(betCap) : '—'}
            {license === 'permit' ? ' · permit — 9/9 sprint lifts the cap' : ''}
          </Text>
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
  /* Modern */
  modernContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  modernStrip: {
    alignSelf: 'stretch',
    marginBottom: 5,
  },
  modernFoot: {
    alignSelf: 'stretch',
    height: 28,
    justifyContent: 'center',
  },
  modernFootText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    opacity: 0.85,
    textAlign: 'center',
  },
});
