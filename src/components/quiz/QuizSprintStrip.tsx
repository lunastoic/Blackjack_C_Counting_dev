import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArcadeMeter, ArcadeStrip, ArcadeStripCell, ArcadeStripDivider } from '../arcade';
import { colors, fonts, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { QuizRank } from './QuizMilestoneBadge';

interface QuizSprintStripProps {
  readonly streak: number;
  readonly target: number;
  /** Streak floors a miss falls back to — ticks on the meter, a star once banked. */
  readonly checkpoints: readonly number[];
  readonly rank: QuizRank;
  readonly cardCount: number;
  /** Seconds per flash, already formatted ("0.66"). */
  readonly secondsPerFlash: string;
  /** >1 while the grand prize is riding. */
  readonly prizeMultiplier: number;
  readonly pot: number;
}

/**
 * The Modern sprint readout under the HUD: the STREAK · RANK · FLASH strip in
 * the table's bevel, the ink-outlined meter filling toward the grand prize
 * with a tick at each checkpoint, and a mono caption for the state.
 */
export function QuizSprintStrip({
  streak,
  target,
  checkpoints,
  rank,
  cardCount,
  secondsPerFlash,
  prizeMultiplier,
  pot,
}: QuizSprintStripProps) {
  const banked = checkpoints.length > 0 && streak >= Math.min(...checkpoints);
  const ready = streak >= target;
  const caption =
    streak === 0
      ? 'Fill the meter for the grand prize'
      : ready
        ? 'Grand prize ready'
        : `${streak} correct — ${target - streak} to go`;

  return (
    <View>
      <ArcadeStrip style={styles.strip}>
        <ArcadeStripCell
          label="Streak"
          value={
            <>
              {streak}
              <Text style={styles.small}>/{target}</Text>
              {banked ? (
                <>
                  {' '}
                  <Ionicons name="star" size={16} color={colors.arcadeGold} />
                </>
              ) : null}
            </>
          }
        />
        <ArcadeStripDivider />
        <ArcadeStripCell
          label="Rank"
          value={rank.title}
          valueColor={rank.arcadeColor}
          flex={1.5}
          valueStyle={styles.rank}
        />
        <ArcadeStripDivider />
        <ArcadeStripCell
          label="Flash"
          flex={1.4}
          value={
            <>
              {cardCount}
              <Text style={styles.flash}> cards · {secondsPerFlash}s</Text>
            </>
          }
        />
      </ArcadeStrip>
      <ArcadeMeter
        progress={streak / target}
        ticks={checkpoints.map((checkpoint) => checkpoint / target)}
        accessibilityLabel={`Streak ${streak} of ${target}`}
        style={styles.meter}
      />
      <Text style={[styles.caption, ready && styles.captionGold]}>{caption.toUpperCase()}</Text>
      {prizeMultiplier > 1 ? (
        <Text style={[styles.caption, styles.captionGold]}>
          {`Riding ×${prizeMultiplier} — ${formatChips(pot)} chips on the line`.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 20,
    marginBottom: 5,
  },
  small: {
    fontSize: 18,
    color: colors.arcadeMuted,
  },
  rank: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.5,
  },
  flash: {
    fontSize: 13,
    letterSpacing: 0,
    color: colors.arcadeMuted,
  },
  meter: {
    marginHorizontal: 20,
    marginTop: spacing.sm,
  },
  caption: {
    marginTop: spacing.xs + spacing.xxs,
    marginHorizontal: 20,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.arcadeMuted,
  },
  captionGold: {
    color: colors.arcadeGold,
  },
});
