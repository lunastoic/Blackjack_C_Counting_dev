import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useModernUi } from '../../hooks/useModernUi';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fonts, fontSizes, fontWeights, lineHeights, radii, spacing } from '../../theme';
import { ArcadeStrip, ArcadeStripCell, ArcadeStripDivider } from '../arcade';

function arcadeCountColor(value: number): string {
  if (value > 0) {
    return colors.arcadeMint;
  }
  if (value < 0) {
    return colors.arcadeLoss;
  }
  return colors.arcadeCream;
}

function countColor(value: number): string {
  if (value > 0) {
    return colors.trainingPlus;
  }
  if (value < 0) {
    return colors.trainingMinus;
  }
  return colors.trainingNeutral;
}

interface LearnCountBarProps {
  /**
   * Training Mode on: both counts print live and the strip is inert. Off, the
   * fog-of-war below applies.
   */
  readonly live?: boolean;
}

/**
 * Table stats strip: running count, true count, cards left. With Training
 * Mode off the counts ride along fogged ("?") until the player proves them.
 * Tier 1 reveals the running count, tier 2 the true count; a shuffle fogs
 * everything again. Tapping the strip (between hands) fires a count check
 * for the next tier.
 */
export function LearnCountBar({ live = false }: LearnCountBarProps) {
  const runningCount = useGameSessionStore((state) => state.runningCount);
  const revealTier = useGameSessionStore((state) => state.revealTier);
  const phase = useGameSessionStore((state) => state.phase);
  const shufflePending = useGameSessionStore((state) => state.shufflePending);
  const justShuffled = useGameSessionStore((state) => state.justShuffled);
  const remaining = useGameSessionStore((state) => state.getCardsRemainingVisible());
  const trueCountValue = useGameSessionStore((state) => state.getTrueCount());
  const requestCountCheck = useGameSessionStore((state) => state.requestCountCheck);

  const runningShown = live || revealTier >= 1;
  const trueShown = live || revealTier >= 2;
  const runningLabel = runningCount > 0 ? `+${runningCount}` : `${runningCount}`;
  const trueLabel = trueCountValue > 0 ? `+${trueCountValue}` : `${trueCountValue}`;
  const canChallenge = !live && revealTier < 2 && phase === 'betting';
  const modern = useModernUi();

  if (modern) {
    const foot = justShuffled
      ? live
        ? 'Shuffled — count reset to 0'
        : 'Shuffled — count reset, meter fogged'
      : shufflePending
        ? 'Shuffling deck after this round'
        : canChallenge
          ? revealTier === 0
            ? 'Tap to prove the running count and reveal it'
            : 'Running count live — tap to unlock the true count'
          : live
            ? 'Training Mode — counts live'
            : '';
    const footColor = justShuffled
      ? colors.arcadeMint
      : shufflePending
        ? colors.arcadeLoss
        : colors.arcadeGold;
    return (
      <Pressable
        onPress={() => requestCountCheck()}
        disabled={!canChallenge}
        accessibilityLabel={
          canChallenge
            ? 'Count fogged — tap to prove your count and reveal it'
            : 'Count meter'
        }
        style={styles.modernContainer}
      >
        <ArcadeStrip compact style={styles.modernStrip}>
          <ArcadeStripCell
            label="Running"
            value={runningShown ? runningLabel : '?'}
            valueColor={runningShown ? arcadeCountColor(runningCount) : colors.arcadeGold}
            compact
          />
          <ArcadeStripDivider />
          <ArcadeStripCell
            label="True"
            value={trueShown ? trueLabel : '?'}
            valueColor={trueShown ? arcadeCountColor(trueCountValue) : colors.arcadeGold}
            compact
          />
          <ArcadeStripDivider />
          <ArcadeStripCell label="Cards left" value={remaining} compact />
        </ArcadeStrip>
        {/* Same fixed two-line foot as Classic: the strip never shifts. */}
        <View style={styles.modernFoot}>
          <Text style={[styles.modernFootText, { color: footColor }]} numberOfLines={2}>
            {foot}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => requestCountCheck()}
      disabled={!canChallenge}
      accessibilityLabel={
        canChallenge
          ? 'Count fogged — tap to prove your count and reveal it'
          : 'Count meter'
      }
      style={styles.container}
    >
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>RUNNING</Text>
          <Text
            style={[
              styles.statValue,
              { color: runningShown ? countColor(runningCount) : colors.gold },
            ]}
          >
            {runningShown ? runningLabel : '?'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>TRUE</Text>
          <Text
            style={[
              styles.statValue,
              { color: trueShown ? countColor(trueCountValue) : colors.gold },
            ]}
          >
            {trueShown ? trueLabel : '?'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>CARDS LEFT</Text>
          <Text style={styles.statValue}>{remaining}</Text>
        </View>
      </View>
      {/* Fixed two-line footer: the strip keeps one size and one centre
          whichever message it carries, so toggling Training Mode never
          shifts the numbers. */}
      <View style={styles.footer}>
        {justShuffled ? (
          <Text style={styles.shuffleNotice} numberOfLines={2}>
            {live ? 'Shuffled — count reset to 0' : 'Shuffled — count reset, meter fogged'}
          </Text>
        ) : shufflePending ? (
          <Text style={styles.shuffleWarning} numberOfLines={2}>
            Shuffling deck after this round
          </Text>
        ) : canChallenge ? (
          <Text style={styles.challengeHint} numberOfLines={2}>
            {revealTier === 0
              ? 'Tap to prove the running count and reveal it'
              : 'Running count live — tap to unlock the true count'}
          </Text>
        ) : live ? (
          <Text style={styles.liveNote} numberOfLines={2}>
            Training Mode — counts live
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // Fill the slot between the piles so the strip is the same width fogged or live.
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(12, 10, 9, 0.55)',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: {
    alignItems: 'center',
    gap: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    alignSelf: 'stretch',
    height: lineHeights.caption * 2,
    justifyContent: 'center',
  },
  challengeHint: {
    color: colors.goldDim,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  liveNote: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  shuffleNotice: {
    color: colors.success,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  shuffleWarning: {
    color: colors.warning,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
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
