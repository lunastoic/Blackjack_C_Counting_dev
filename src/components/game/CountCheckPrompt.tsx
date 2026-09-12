import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { FEATURES } from '../../constants/features';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fonts, fontSizes, fontWeights, layout, radii, shadows, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { ArcadeButton, ArcadeInfoBox, ArcadePanel, arcadeText } from '../arcade';
import { PressableScale } from '../common/PressableScale';
import { PrimaryButton } from '../common/PrimaryButton';
import { ModernPlaque } from './ModernPlaque';

const HI_LO_REMINDER = '2–6 count +1  ·  7–9 count 0  ·  10–A count −1';
/** The Modern panel rides above the chip tray, off the bottom of the felt. */
const MODERN_PANEL_LIFT = 214;

/**
 * Learn coach pop quiz. Appears over the felt between rounds when the Count
 * Coach queued a check: pick the running (or, at higher streaks, true) count
 * from four choices. Correct pays 3 XP; the streak controls how often the
 * coach checks in.
 */
export function CountCheckPrompt() {
  const reducedMotion = useReducedMotion();
  const phase = useGameSessionStore((state) => state.phase);
  const check = useGameSessionStore((state) => state.countCheck);
  const learnStreak = useGameSessionStore((state) => state.learnStreak);
  const revealTier = useGameSessionStore((state) => state.revealTier);
  const answerCountCheck = useGameSessionStore((state) => state.answerCountCheck);
  const dismissCountCheck = useGameSessionStore((state) => state.dismissCountCheck);
  const modern = useModernUi();

  if (!check || phase !== 'betting') {
    return null;
  }

  const answered = check.selected !== null;
  const isTrue = check.kind === 'true';

  function handleAnswer(choice: number) {
    const correct = answerCountCheck(choice);
    if (correct) {
      playSound('win');
      void haptics.success();
    } else {
      playSound('loss');
      void haptics.warning();
    }
  }

  const revealNote = check.shuffledAfter
    ? 'Fresh shoe — the meter fogs until you prove the new count.'
    : check.wasCorrect
      ? revealTier >= 2
        ? 'True count unlocked — both numbers are live on the table.'
        : 'Running count revealed on the meter — prove the true count next.'
      : 'The meter fogs a tier — win it back on the next check.';
  const streakLine = FEATURES.autoCountChecks
    ? learnStreak > 0
      ? `Check streak: ${learnStreak} — the coach backs off while you're hot`
      : 'The coach checks every round until you find your rhythm'
    : learnStreak > 0
      ? `Check streak: ${learnStreak}`
      : 'Tap the meter between hands whenever you want to prove your count';

  if (modern) {
    // The level-brief panel, lowered over the tray: kicker tab, the question
    // (or the verdict) on the plaque, four neutral bevels, mono captions.
    return (
      <Animated.View
        style={[styles.overlay, styles.overlayModern]}
        entering={reducedMotion ? undefined : FadeIn.duration(180)}
      >
        <Animated.View
          style={styles.panelSlotModern}
          entering={reducedMotion ? undefined : FadeInDown.duration(220)}
        >
          <ArcadePanel style={styles.panelModern}>
            {!answered ? (
              <>
                <ModernPlaque
                  tab="Count check"
                  title={isTrue ? 'What is the true count?' : 'What is the running count?'}
                  small
                />
                {isTrue ? (
                  <Text style={arcadeText.caption}>Running count ÷ decks left, to the nearest ½.</Text>
                ) : null}
                <View style={styles.gridModern}>
                  {check.choices.map((choice) => (
                    <ArcadeButton
                      key={choice}
                      label={formatCount(choice)}
                      accessibilityLabel={`Answer ${formatCount(choice)}`}
                      variant="neutral"
                      size="large"
                      onPress={() => handleAnswer(choice)}
                      style={styles.gridButtonModern}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <ModernPlaque
                  tab="Count check"
                  title={check.wasCorrect ? 'Correct! +3 XP' : 'Not quite'}
                  color={check.wasCorrect ? colors.arcadeMint : colors.arcadeLoss}
                  small
                />
                <ArcadeInfoBox>
                  {isTrue ? 'True count: ' : 'Running count: '}
                  <Text style={styles.infoStrongModern}>
                    {formatCount(isTrue ? check.trueCount : check.runningCount)}
                  </Text>
                  {isTrue ? ` (running ${formatCount(check.runningCount)})` : ''}
                  {!check.wasCorrect && check.selected !== null
                    ? ` — you picked ${formatCount(check.selected)}`
                    : ''}
                </ArcadeInfoBox>
                {!check.wasCorrect ? (
                  <Text style={[arcadeText.caption, styles.capRedModern]}>{HI_LO_REMINDER}</Text>
                ) : null}
                <Text style={[arcadeText.caption, styles.capGoldModern]}>{revealNote}</Text>
                {check.shuffledAfter ? (
                  <Text style={[arcadeText.caption, styles.capMintModern]}>
                    Shoe shuffled — the next count starts at 0.
                  </Text>
                ) : null}
                <ArcadeButton
                  label="Keep playing"
                  trailing="▶"
                  onPress={dismissCountCheck}
                  style={styles.keepPlayingModern}
                />
              </>
            )}
            <Text style={arcadeText.caption}>{streakLine}</Text>
          </ArcadePanel>
        </Animated.View>
      </Animated.View>
    );
  }

  // The overlay blocks the table until the check is answered — that's the drill.
  return (
    <Animated.View
      style={styles.overlay}
      entering={reducedMotion ? undefined : FadeIn.duration(180)}
    >
      <Animated.View
        style={styles.card}
        entering={reducedMotion ? undefined : FadeInDown.duration(220)}
      >
        <Text style={styles.kicker}>COUNT CHECK</Text>
        <Text style={styles.question}>
          {isTrue ? 'What is the TRUE count?' : 'What is the running count?'}
        </Text>
        {isTrue && !answered ? (
          <Text style={styles.hint}>Running count ÷ decks left, to the nearest ½.</Text>
        ) : null}

        {!answered ? (
          <View style={styles.choiceGrid}>
            {check.choices.map((choice) => (
              <PressableScale
                key={choice}
                accessibilityLabel={`Answer ${formatCount(choice)}`}
                onPress={() => handleAnswer(choice)}
                style={styles.choiceButton}
              >
                <Text style={styles.choiceText}>{formatCount(choice)}</Text>
              </PressableScale>
            ))}
          </View>
        ) : (
          <View style={styles.feedback}>
            <Text
              style={[
                styles.feedbackTitle,
                { color: check.wasCorrect ? colors.success : colors.error },
              ]}
            >
              {check.wasCorrect ? 'Correct! +3 XP' : 'Not quite'}
            </Text>
            <Text style={styles.feedbackBody}>
              {isTrue
                ? `True count: ${formatCount(check.trueCount)} (running ${formatCount(check.runningCount)})`
                : `Running count: ${formatCount(check.runningCount)}`}
              {!check.wasCorrect && check.selected !== null
                ? ` — you picked ${formatCount(check.selected)}`
                : ''}
            </Text>
            {!check.wasCorrect ? (
              <Text style={styles.reminder}>{HI_LO_REMINDER}</Text>
            ) : null}
            <Text style={styles.revealNote}>{revealNote}</Text>
            {check.shuffledAfter ? (
              <Text style={styles.shuffleNote}>Shoe shuffled — the next count starts at 0.</Text>
            ) : null}
            <PrimaryButton label="Keep playing" onPress={dismissCountCheck} />
          </View>
        )}

        <Text style={styles.streakLine}>{streakLine}</Text>
      </Animated.View>
    </Animated.View>
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
    paddingVertical: spacing.lg,
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
  question: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  choiceButton: {
    minWidth: 120,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.overlayLight,
    alignItems: 'center',
  },
  choiceText: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  feedback: {
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  feedbackTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  feedbackBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
  },
  reminder: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  shuffleNote: {
    color: colors.success,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  revealNote: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  streakLine: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  /* Modern */
  overlayModern: {
    justifyContent: 'flex-end',
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: MODERN_PANEL_LIFT,
  },
  panelSlotModern: {
    alignSelf: 'stretch',
  },
  panelModern: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm + spacing.xxs,
    gap: spacing.xs + spacing.xxs,
    ...shadows.overlay,
  },
  gridModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.sm + spacing.xxs,
    rowGap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  gridButtonModern: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '40%',
    minWidth: 120,
  },
  infoStrongModern: {
    fontFamily: fonts.monoMedium,
    color: colors.arcadeGold,
  },
  capGoldModern: {
    color: colors.arcadeGold,
  },
  capMintModern: {
    color: colors.arcadeMint,
  },
  capRedModern: {
    fontFamily: fonts.monoMedium,
    color: colors.arcadeLoss,
    letterSpacing: 0.5,
  },
  keepPlayingModern: {
    alignSelf: 'stretch',
  },
});
