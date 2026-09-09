import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { FLASH_LEVELS_PER_MAP } from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { AccuracyRow, AccuracyRows } from '../training/AccuracyRows';

interface FlashLevelCompleteOverlayProps {
  readonly mapName: string;
  readonly level: number;
  /** Stars this run earned. */
  readonly stars: number;
  readonly xpAwarded: number;
  /** Chips the run's new stars paid. */
  readonly chipsAwarded: number;
  /** Headline for the clear — "21 in a row." / "10 of 10 checks." */
  readonly title: string;
  /** What comes next — "Next up: Card Groups." */
  readonly body: string;
  /** Exam scorecard (per-kind accuracies), when the level keeps one. */
  readonly scorecard?: readonly AccuracyRow[];
  /** This clear opened the casino's table. */
  readonly tableUnlocked: boolean;
  /** The whole ladder is done (now or earlier) — the table is open. */
  readonly tableOpen: boolean;
  readonly onNextLevel: () => void;
  readonly onSitAtTable: () => void;
  readonly onQuiz: () => void;
  readonly onLevelMap: () => void;
  readonly onReplay: () => void;
}

/** Results card after a training level is cleared. */
export function FlashLevelCompleteOverlay({
  mapName,
  level,
  stars,
  xpAwarded,
  chipsAwarded,
  title,
  body,
  scorecard,
  tableUnlocked,
  tableOpen,
  onNextLevel,
  onSitAtTable,
  onQuiz,
  onLevelMap,
  onReplay,
}: FlashLevelCompleteOverlayProps) {
  const reducedMotion = useReducedMotion();
  const hasNext = level < FLASH_LEVELS_PER_MAP;

  return (
    <Animated.View
      style={styles.overlay}
      entering={reducedMotion ? undefined : FadeIn.duration(180)}
    >
      <Animated.View
        style={styles.card}
        entering={reducedMotion ? undefined : FadeInDown.duration(240)}
      >
        <Text style={styles.kicker}>LEVEL {level} CLEARED</Text>
        <View style={styles.stars} accessibilityLabel={`${stars} of 3 stars`}>
          {[0, 1, 2].map((index) => (
            <Ionicons
              key={index}
              name={index < stars ? 'star' : 'star-outline'}
              size={34}
              color={index < stars ? colors.goldBright : colors.textMuted}
            />
          ))}
        </View>

        {scorecard && scorecard.length > 0 ? <AccuracyRows rows={scorecard} /> : null}
        {tableUnlocked ? (
          <>
            <Text style={styles.title}>{mapName} is open</Text>
            <View style={styles.unlockList}>
              <UnlockRow icon="cash-outline" text="Table — real hands, your chips on the line." />
              <UnlockRow
                icon="options-outline"
                text="≡ menu — switch card glow and strategy hints on or off."
              />
              <UnlockRow icon="flash-outline" text="Quiz — random cards, call the count, beat your best." />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </>
        )}
        {xpAwarded > 0 || chipsAwarded > 0 ? (
          <View style={styles.rewards}>
            {chipsAwarded > 0 ? (
              <Text style={styles.chips}>+{formatChips(chipsAwarded)} chips</Text>
            ) : null}
            {xpAwarded > 0 ? <Text style={styles.xp}>+{xpAwarded} XP</Text> : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          {tableOpen ? <PrimaryButton label="Sit at the table" onPress={onSitAtTable} /> : null}
          {tableOpen ? <SecondaryButton label="Quiz mode" onPress={onQuiz} /> : null}
          {hasNext ? (
            tableOpen ? (
              <SecondaryButton label={`Level ${level + 1}`} onPress={onNextLevel} />
            ) : (
              <PrimaryButton label={`Level ${level + 1}`} onPress={onNextLevel} />
            )
          ) : null}
          <SecondaryButton label="Level map" onPress={onLevelMap} />
          <Text style={styles.replay} onPress={onReplay} accessibilityRole="button">
            Replay this level
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function UnlockRow({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
}) {
  return (
    <View style={styles.unlockRow}>
      <Ionicons name={icon} size={18} color={colors.goldBright} />
      <Text style={styles.unlockText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    zIndex: 40,
  },
  card: {
    width: '88%',
    maxWidth: 380,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...shadows.overlay,
  },
  kicker: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.heavy,
    letterSpacing: 2,
  },
  stars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  unlockList: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  unlockText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    lineHeight: 20,
  },
  rewards: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  chips: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  xp: {
    color: colors.success,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  replay: {
    color: colors.gold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
