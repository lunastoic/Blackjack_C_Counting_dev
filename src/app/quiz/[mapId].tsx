import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_BACK } from '../../assets/cards.generated';
import { TABLE_FELTS } from '../../assets/registry';
import { CARD_ASPECT, PlayingCard } from '../../components/game/PlayingCard';
import { IconButton } from '../../components/common/IconButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { SecondaryButton } from '../../components/common/SecondaryButton';
import { GameToasts } from '../../components/game/GameToasts';
import { mapById } from '../../engine/betting/casino';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import {
  QUIZ_GRAND_PRIZE_CHIPS,
  QUIZ_STREAK_TARGET,
  quizDifficultyForStreak,
  useQuizSessionStore,
} from '../../stores/quizSessionStore';
import { useModeStatsStore } from '../../stores/modeStatsStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { QuizChoiceButton } from '../../components/quiz/QuizChoiceButton';
import { QuizFlashStage } from '../../components/quiz/QuizFlashStage';
import { QuizMilestoneBadge } from '../../components/quiz/QuizMilestoneBadge';
import { QuizStreakMeter } from '../../components/quiz/QuizStreakMeter';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatChips } from '../../utils/format';

/**
 * Quiz Mode — the Count Sprint. Cards flash fast, decoys test focus, and a
 * nine-circle streak meter climbs toward the grand prize. The blackjack logic
 * is identical to the regular tables; only the presentation is tuned for a
 * quick-fire counting drill.
 */
export default function QuizScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { mapId } = useLocalSearchParams<{ mapId: string }>();
  const parsed = Number(mapId);
  const map = Number.isInteger(parsed) ? mapById(parsed) : undefined;

  const startSession = useQuizSessionStore((state) => state.startSession);
  const endSession = useQuizSessionStore((state) => state.endSession);
  const sessionActive = useQuizSessionStore((state) => state.sessionActive);
  const phase = useQuizSessionStore((state) => state.phase);
  const flashCards = useQuizSessionStore((state) => state.flashCards);
  const steps = useQuizSessionStore((state) => state.steps);
  const stepIndex = useQuizSessionStore((state) => state.stepIndex);
  const flashMs = useQuizSessionStore((state) => state.flashMs);
  const choices = useQuizSessionStore((state) => state.choices);
  const selectedChoice = useQuizSessionStore((state) => state.selectedChoice);
  const correctAnswer = useQuizSessionStore((state) => state.correctAnswer);
  const wasCorrect = useQuizSessionStore((state) => state.wasCorrect);
  const streak = useQuizSessionStore((state) => state.streak);
  const rewardReady = useQuizSessionStore((state) => state.rewardReady);
  const questionsAnswered = useQuizSessionStore((state) => state.questionsAnswered);
  const questionsCorrect = useQuizSessionStore((state) => state.questionsCorrect);
  const startQuestion = useQuizSessionStore((state) => state.startQuestion);
  const answer = useQuizSessionStore((state) => state.answer);
  const claimGrandPrize = useQuizSessionStore((state) => state.claimGrandPrize);
  const levelUpNotice = useQuizSessionStore((state) => state.levelUpNotice);
  const dismissLevelUp = useQuizSessionStore((state) => state.dismissLevelUp);
  const dealerSpeed = useSettingsStore((state) => state.dealerSpeed);

  const quizStats = useModeStatsStore((state) => state.quiz);

  useEffect(() => {
    if (map) {
      startSession(map.id);
    }
    return () => {
      endSession();
    };
  }, [map, startSession, endSession]);

  useEffect(() => {
    if (phase !== 'feedback') {
      return;
    }
    if (wasCorrect) {
      playSound('win');
      void haptics.success();
    } else {
      playSound('loss');
      void haptics.warning();
    }
  }, [phase, wasCorrect]);

  if (!map) {
    return <Redirect href={{ pathname: '/game/[mapId]', params: { mapId: '1' } }} />;
  }
  if (!sessionActive) {
    return <View style={styles.root} />;
  }

  const difficulty = quizDifficultyForStreak(streak);
  const secondsPerFlash = (flashMs / dealerSpeed / 1000).toFixed(2);
  const currentStep = phase === 'flashing' && stepIndex >= 0 ? steps[stepIndex] : null;
  const lifetimeAccuracy =
    quizStats.questionsAnswered > 0
      ? Math.round((quizStats.questionsCorrect / quizStats.questionsAnswered) * 100)
      : null;

  function leaveQuiz() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: '/game/[mapId]', params: { mapId: String(map!.id) } });
    }
  }

  function choiceState(choice: number) {
    if (phase !== 'feedback') {
      return 'idle';
    }
    if (choice === correctAnswer) {
      return 'correct';
    }
    if (choice === selectedChoice) {
      return 'wrong';
    }
    return 'idle';
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Image
        source={TABLE_FELTS[map.feltKey] ?? TABLE_FELTS['gray-suede']}
        style={styles.felt}
        resizeMode="cover"
      />
      <View style={styles.feltTint} pointerEvents="none" />

      <View style={styles.topBar}>
        <IconButton glyph="‹" accessibilityLabel="Leave quiz" onPress={leaveQuiz} />
        <View style={styles.topInfo}>
          <Text style={styles.mapName} numberOfLines={1}>
            {map.name}
          </Text>
          <Text style={styles.topMeta}>
            Session {questionsCorrect}/{questionsAnswered}
            {lifetimeAccuracy !== null ? ` · lifetime ${lifetimeAccuracy}%` : ''}
            {quizStats.bestStreak > 0 ? ` · best ${quizStats.bestStreak}` : ''}
          </Text>
        </View>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.meterRow}>
        <QuizMilestoneBadge streak={streak} />
      </View>

      <QuizStreakMeter streak={streak} target={QUIZ_STREAK_TARGET} />

      <Text style={styles.difficultyLine}>
        {difficulty.cardCount} cards
        {difficulty.decoyCount > 0
          ? ` · ${difficulty.decoyCount} decoy${difficulty.decoyCount > 1 ? 's' : ''}`
          : ''}
        {` · ${secondsPerFlash}s flash`}
        {difficulty.pairFlash ? ' · pairs' : ''}
      </Text>

      <View style={styles.stage}>
        {phase === 'idle' ? (
          <Animated.View
            style={styles.centerBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
          >
            <View style={styles.introIcon}>
              <Text style={styles.introIconText}>♠</Text>
            </View>
            <Text style={styles.promptTitle}>Count Sprint</Text>
            <Text style={styles.promptBody}>
              Cards flash fast — keep the Hi-Lo running count, then pick the total. Face-down
              decoys count for nothing. Fill all {QUIZ_STREAK_TARGET} circles for the{' '}
              {formatChips(QUIZ_GRAND_PRIZE_CHIPS)}-chip grand prize.
            </Text>
            <PrimaryButton label="Start Sprint" onPress={() => startQuestion()} />
          </Animated.View>
        ) : null}

        <QuizFlashStage step={currentStep} stepIndex={stepIndex} totalSteps={steps.length} />

        {phase === 'question' ? (
          <Animated.View
            style={styles.centerBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(250)}
          >
            <Text style={styles.promptTitle}>What was the count?</Text>
            {difficulty.decoyCount > 0 ? (
              <Text style={styles.promptHint}>Remember: face-down decoys are zero.</Text>
            ) : null}
            <View style={styles.choiceGrid}>
              {choices.map((choice) => (
                <QuizChoiceButton
                  key={choice}
                  value={choice}
                  label={formatCount(choice)}
                  state={choiceState(choice)}
                  accessibilityLabel={`Answer ${formatCount(choice)}`}
                  onPress={() => answer(choice)}
                />
              ))}
            </View>
          </Animated.View>
        ) : null}

        {phase === 'feedback' ? (
          <Animated.View
            style={styles.centerBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(250)}
          >
            <Animated.View
              entering={reducedMotion ? undefined : ZoomIn.duration(300)}
              style={[
                styles.feedbackBadge,
                { backgroundColor: wasCorrect ? 'rgba(61, 187, 110, 0.15)' : 'rgba(224, 82, 77, 0.12)' },
              ]}
            >
              <Text style={[styles.feedbackGlyph, { color: wasCorrect ? colors.success : colors.error }]}>
                {rewardReady ? '👑' : wasCorrect ? '✓' : '✕'}
              </Text>
              <Text
                style={[
                  styles.feedbackTitle,
                  { color: wasCorrect ? colors.success : colors.error },
                ]}
              >
                {rewardReady
                  ? 'Grand Prize Unlocked!'
                  : wasCorrect
                    ? 'Correct — +3 XP'
                    : 'Streak Broken'}
              </Text>
            </Animated.View>

            <Text style={styles.promptBody}>
              The count was <Text style={styles.answerEmphasis}>{formatCount(correctAnswer)}</Text>
              {!wasCorrect && selectedChoice !== null
                ? ` — you picked ${formatCount(selectedChoice)}`
                : ''}
            </Text>

            <View style={styles.reviewRow}>
              {flashCards.map((item) =>
                item.faceDown ? (
                  <Image
                    key={item.card.id}
                    source={CARD_BACK}
                    style={{
                      width: Math.min((width - 64) / flashCards.length - 4, 56),
                      height: Math.min((width - 64) / flashCards.length - 4, 56) / CARD_ASPECT,
                      borderRadius: 4,
                      opacity: 0.65,
                    }}
                    accessibilityLabel="Decoy card"
                  />
                ) : (
                  <PlayingCard
                    key={item.card.id}
                    card={item.card}
                    skin="training"
                    width={Math.min((width - 64) / flashCards.length - 4, 56)}
                    underglow
                  />
                ),
              )}
            </View>

            {rewardReady ? (
              <PrimaryButton
                label={`Claim ${formatChips(QUIZ_GRAND_PRIZE_CHIPS)} chips`}
                onPress={() => {
                  if (claimGrandPrize()) {
                    playSound('achievementUnlock');
                    void haptics.success();
                  }
                }}
              />
            ) : (
              <PrimaryButton label="Next cards" onPress={() => startQuestion()} />
            )}
            <SecondaryButton label="Back to table" onPress={leaveQuiz} />
          </Animated.View>
        ) : null}
      </View>

      <GameToasts levelUpNotice={levelUpNotice} onDismissLevelUp={dismissLevelUp} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  felt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: undefined,
    height: undefined,
  },
  feltTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 10, 18, 0.45)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  topInfo: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  topSpacer: {
    width: 44,
  },
  mapName: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  topMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontVariant: ['tabular-nums'],
  },
  meterRow: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  difficultyLine: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginTop: spacing.sm,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  centerBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  introIconText: {
    color: colors.gold,
    fontSize: 40,
    lineHeight: 44,
  },
  promptTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  promptBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  promptHint: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  feedbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  feedbackGlyph: {
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
  },
  feedbackTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  answerEmphasis: {
    color: colors.goldBright,
    fontWeight: fontWeights.bold,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
});
