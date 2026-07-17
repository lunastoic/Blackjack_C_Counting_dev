import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABLE_FELTS } from '../../assets/registry';
import { IconButton } from '../../components/common/IconButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { PressableScale } from '../../components/common/PressableScale';
import { SecondaryButton } from '../../components/common/SecondaryButton';
import { GameToasts } from '../../components/game/GameToasts';
import { PlayingCard } from '../../components/game/PlayingCard';
import { mapById } from '../../engine/betting/casino';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import {
  QUIZ_STREAK_REWARD_CHIPS,
  QUIZ_STREAK_TARGET,
  useQuizSessionStore,
} from '../../stores/quizSessionStore';
import { useModeStatsStore } from '../../stores/modeStatsStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';

/**
 * Quiz Mode (REBUILD_SPEC §11): cards flash one at a time, then the player
 * picks the running count from four choices. Correct answers pay 3 XP and
 * fill one of nine circles; nine in a row pays 250 chips.
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
  const cards = useQuizSessionStore((state) => state.cards);
  const flashIndex = useQuizSessionStore((state) => state.flashIndex);
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
  const claimStreakReward = useQuizSessionStore((state) => state.claimStreakReward);
  const levelUpNotice = useQuizSessionStore((state) => state.levelUpNotice);
  const dismissLevelUp = useQuizSessionStore((state) => state.dismissLevelUp);

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
    // Bad or stale link — land the player at the default table instead.
    return (
      <Redirect
        href={{ pathname: '/game/[mapId]', params: { mapId: '1', mode: 'training' } }}
      />
    );
  }
  if (!sessionActive) {
    return <View style={styles.root} />;
  }

  const cardWidth = Math.min(width * 0.38, 150);
  const flashCard = phase === 'flashing' && flashIndex >= 0 ? cards[flashIndex] : null;
  const lifetimeAccuracy =
    quizStats.questionsAnswered > 0
      ? Math.round((quizStats.questionsCorrect / quizStats.questionsAnswered) * 100)
      : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Image
        source={TABLE_FELTS[map.feltKey] ?? TABLE_FELTS['gray-suede']}
        style={styles.felt}
        resizeMode="cover"
      />
      <View style={styles.feltTint} pointerEvents="none" />

      <View style={styles.topBar}>
        <IconButton
          glyph="‹"
          accessibilityLabel="Leave quiz"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace({
                pathname: '/game/[mapId]',
                params: { mapId: String(map.id), mode: 'training' },
              });
            }
          }}
        />
        <View style={styles.topInfo}>
          <Text style={styles.mapName} numberOfLines={1}>
            {map.name} · Quiz
          </Text>
          <Text style={styles.topMeta}>
            Session {questionsCorrect}/{questionsAnswered}
            {lifetimeAccuracy !== null ? ` · lifetime ${lifetimeAccuracy}%` : ''}
            {quizStats.bestStreak > 0 ? ` · best streak ${quizStats.bestStreak}` : ''}
          </Text>
        </View>
        <View style={styles.topSpacer} />
      </View>

      {/* Streak circles: 1 of 9 fills per correct answer. */}
      <View style={styles.streakRow} accessibilityLabel={`Streak ${streak} of ${QUIZ_STREAK_TARGET}`}>
        {Array.from({ length: QUIZ_STREAK_TARGET }, (_, i) => (
          <View key={i} style={[styles.streakDot, i < streak && styles.streakDotFilled]} />
        ))}
      </View>

      <View style={styles.stage}>
        {phase === 'idle' ? (
          <View style={styles.centerBlock}>
            <Text style={styles.promptTitle}>Count the cards</Text>
            <Text style={styles.promptBody}>
              3–7 cards flash one at a time. Keep the Hi-Lo running count, then pick the total.
              Each correct answer earns 3 XP — {QUIZ_STREAK_TARGET} in a row pays{' '}
              {formatChips(QUIZ_STREAK_REWARD_CHIPS)} chips.
            </Text>
            <PrimaryButton label="Start" onPress={() => startQuestion()} />
          </View>
        ) : null}

        {phase === 'flashing' && flashCard ? (
          <View style={styles.centerBlock}>
            {/* Keyed so each card re-mounts and replays its entrance. */}
            <Animated.View
              key={flashCard.id}
              entering={reducedMotion ? undefined : FadeIn.duration(150)}
            >
              <PlayingCard card={flashCard} skin="regular" width={cardWidth} underglow={false} />
            </Animated.View>
            <Text style={styles.flashProgress}>
              Card {flashIndex + 1} of {cards.length}
            </Text>
          </View>
        ) : null}

        {phase === 'question' ? (
          <Animated.View
            style={styles.centerBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(200)}
          >
            <Text style={styles.promptTitle}>What was the count?</Text>
            <View style={styles.choiceGrid}>
              {choices.map((choice) => (
                <PressableScale
                  key={choice}
                  accessibilityLabel={`Answer ${choice}`}
                  onPress={() => answer(choice)}
                  style={styles.choiceButton}
                >
                  <Text style={styles.choiceText}>{choice > 0 ? `+${choice}` : choice}</Text>
                </PressableScale>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {phase === 'feedback' ? (
          <Animated.View
            style={styles.centerBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(200)}
          >
            <Text style={[styles.feedbackTitle, { color: wasCorrect ? colors.success : colors.error }]}>
              {wasCorrect ? 'Correct! +3 XP' : 'Not quite'}
            </Text>
            <Text style={styles.promptBody}>
              The count was {correctAnswer > 0 ? `+${correctAnswer}` : correctAnswer}
              {!wasCorrect && selectedChoice !== null
                ? ` — you picked ${selectedChoice > 0 ? `+${selectedChoice}` : selectedChoice}`
                : ''}
            </Text>
            {/* Replay the flashed cards so misses become a lesson. */}
            <View style={styles.reviewRow}>
              {cards.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  skin="training"
                  width={Math.min((width - 64) / cards.length - 4, 56)}
                  underglow
                />
              ))}
            </View>
            {rewardReady ? (
              <PrimaryButton
                label={`Claim ${formatChips(QUIZ_STREAK_REWARD_CHIPS)} chips`}
                onPress={() => {
                  if (claimStreakReward()) {
                    playSound('betPlaced');
                    void haptics.success();
                  }
                }}
              />
            ) : (
              <PrimaryButton label="Next cards" onPress={() => startQuestion()} />
            )}
            <SecondaryButton
              label="Back to table"
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace({
                      pathname: '/game/[mapId]',
                      params: { mapId: String(map.id), mode: 'training' },
                    })
              }
            />
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
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  streakDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: 'transparent',
  },
  streakDotFilled: {
    backgroundColor: colors.gold,
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
  promptTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  promptBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  flashProgress: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontVariant: ['tabular-nums'],
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  choiceButton: {
    minWidth: 96,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
  feedbackTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
});
