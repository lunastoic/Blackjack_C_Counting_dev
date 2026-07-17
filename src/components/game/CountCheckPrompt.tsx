import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { PressableScale } from '../common/PressableScale';
import { PrimaryButton } from '../common/PrimaryButton';

const HI_LO_REMINDER = '2–6 count +1  ·  7–9 count 0  ·  10–A count −1';

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
  const answerCountCheck = useGameSessionStore((state) => state.answerCountCheck);
  const dismissCountCheck = useGameSessionStore((state) => state.dismissCountCheck);

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
            {check.shuffledAfter ? (
              <Text style={styles.shuffleNote}>Shoe shuffled — the next count starts at 0.</Text>
            ) : null}
            <PrimaryButton label="Keep playing" onPress={dismissCountCheck} />
          </View>
        )}

        <Text style={styles.streakLine}>
          {learnStreak > 0
            ? `Check streak: ${learnStreak} — the coach backs off while you're hot`
            : 'The coach checks every round until you find your rhythm'}
        </Text>
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
  streakLine: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
});
