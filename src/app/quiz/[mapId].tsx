import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArcadeButton, ArcadeInfoBox } from '../../components/arcade';
import { ArcadeLevelBrief } from '../../components/arcade/ArcadeLevelBrief';
import { IconButton } from '../../components/common/IconButton';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { SecondaryButton } from '../../components/common/SecondaryButton';
import { FeltBackdrop } from '../../components/game/FeltBackdrop';
import { GameSettingsSheet } from '../../components/game/GameSettingsSheet';
import { GameTableHud } from '../../components/game/GameTableHud';
import { GameToasts } from '../../components/game/GameToasts';
import { mapById } from '../../engine/betting/casino';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import {
  QUIZ_CHECKPOINTS,
  QUIZ_DIRECT_ENTRY_STREAK,
  QUIZ_GRAND_PRIZE_CHIPS,
  QUIZ_MAX_RIDE_MULTIPLIER,
  QUIZ_STREAK_TARGET,
  quizDifficultyForStreak,
  useQuizSessionStore,
} from '../../stores/quizSessionStore';
import { useModeStatsStore } from '../../stores/modeStatsStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { QuizChoiceButton } from '../../components/quiz/QuizChoiceButton';
import { QuizCountEntry } from '../../components/quiz/QuizCountEntry';
import { QuizCountReview } from '../../components/quiz/QuizCountReview';
import { QuizFlashStage } from '../../components/quiz/QuizFlashStage';
import { QuizMilestoneBadge, quizRankForStreak } from '../../components/quiz/QuizMilestoneBadge';
import { SprintPanel, SprintPlaque } from '../../components/quiz/QuizSprintPanel';
import { QuizSprintStrip } from '../../components/quiz/QuizSprintStrip';
import { QuizStreakMeter } from '../../components/quiz/QuizStreakMeter';
import { colors, fonts, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatChips } from '../../utils/format';

/**
 * Pushes the flash cards and the question down the stage so they start below
 * the house lettering printed mid-felt (see FeltBackdrop).
 */
const STAGE_LETTERING_CLEARANCE = 96;
/** Modern: the flash cards sit this far above the home indicator. */
const STAGE_ARCADE_FLASH_LIFT = 76;

/**
 * Quiz Mode — the Count Sprint. Cards flash fast, decoys test focus, and a
 * nine-circle streak meter climbs toward the grand prize. The blackjack logic
 * is identical to the regular tables; only the presentation is tuned for a
 * quick-fire counting drill.
 */
export default function QuizScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const modern = useModernUi();
  // Modern: the HUD's ≡ opens the same sheet as the table.
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const prizeMultiplier = useQuizSessionStore((state) => state.prizeMultiplier);
  const rideLost = useQuizSessionStore((state) => state.rideLost);
  const licenseEarned = useQuizSessionStore((state) => state.licenseEarned);
  const xpAwarded = useQuizSessionStore((state) => state.xpAwarded);
  const questionsAnswered = useQuizSessionStore((state) => state.questionsAnswered);
  const questionsCorrect = useQuizSessionStore((state) => state.questionsCorrect);
  const startQuestion = useQuizSessionStore((state) => state.startQuestion);
  const answer = useQuizSessionStore((state) => state.answer);
  const claimGrandPrize = useQuizSessionStore((state) => state.claimGrandPrize);
  const letItRide = useQuizSessionStore((state) => state.letItRide);
  const levelUpNotice = useQuizSessionStore((state) => state.levelUpNotice);
  const dismissLevelUp = useQuizSessionStore((state) => state.dismissLevelUp);
  const dealerSpeed = useSettingsStore((state) => state.dealerSpeed);

  const quizStats = useModeStatsStore((state) => state.quiz);
  const license = useProgressionStore((state) =>
    map ? state.licenseForMap(map.id) : 'none',
  );

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

  useEffect(() => {
    if (phase === 'feedback' && licenseEarned) {
      playSound('achievementUnlock');
    }
  }, [phase, licenseEarned]);

  // A soft card-flick per flash step — the metronome that keeps the count.
  useEffect(() => {
    if (phase === 'flashing' && stepIndex >= 0) {
      playSound('cardFlip');
    }
  }, [phase, stepIndex]);

  if (!map) {
    return <Redirect href={{ pathname: '/game/[mapId]', params: { mapId: '1' } }} />;
  }
  if (!sessionActive) {
    return <View style={styles.root} />;
  }

  const difficulty = quizDifficultyForStreak(streak);
  const secondsPerFlash = (flashMs / dealerSpeed / 1000).toFixed(2);
  const currentStep = phase === 'flashing' && stepIndex >= 0 ? steps[stepIndex] : null;
  const pot = QUIZ_GRAND_PRIZE_CHIPS * prizeMultiplier;
  const directEntry = streak >= QUIZ_DIRECT_ENTRY_STREAK;
  /** Show the Hi-Lo crib sheet until counting has clearly clicked. */
  const showPrimer = quizStats.questionsAnswered < 20;
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

  const promptLead =
    `Cards flash fast — keep the Hi-Lo running count, then pick the total. Face-down ` +
    `decoys count for nothing. `;
  const promptBody =
    `${promptLead}Fill all ${QUIZ_STREAK_TARGET} circles for the ` +
    `${formatChips(QUIZ_GRAND_PRIZE_CHIPS)}-chip grand prize.`;
  // Modern: the intro is the arcade card; the primer folds into its copy and
  // the licence ladder into its rule pills. The circles are a meter there.
  const modernIntro = modern && phase === 'idle';
  const arcadeLead = `${promptLead}Fill the meter for the ${formatChips(QUIZ_GRAND_PRIZE_CHIPS)}-chip grand prize.`;
  const arcadeBody = showPrimer
    ? `${arcadeLead}\n\nHi-Lo in one line: 2–6 count +1, 7–9 count 0, 10–A count −1. ` +
      'Add them up as the cards flash. Every shuffle starts back at 0.'
    : arcadeLead;
  const arcadeRules =
    license === 'none' ? [`3 in a row opens the ${map.name} table`, 'All 9 unlock full stakes'] : [];
  // The question plaque's tab recaps the flash that just ran.
  const decoysFlashed = flashCards.filter((item) => item.faceDown).length;
  const flashTab =
    `${flashCards.length} cards` +
    (decoysFlashed > 0 ? ` · ${decoysFlashed} decoy${decoysFlashed > 1 ? 's' : ''}` : '');
  const feedbackTitle = rewardReady
    ? 'Grand Prize Unlocked!'
    : wasCorrect
      ? `Correct — +${xpAwarded} XP`
      : rideLost
        ? 'Ride Lost!'
        : streak > 0
          ? `Streak Broken — back to ${streak}`
          : 'Streak Broken';
  const licenseLine = licenseEarned
    ? licenseEarned === 'licensed'
      ? `🏆 Full table license — max bets unlocked at ${map.name}!`
      : `🎟️ Table permit earned — ${map.name}'s floor is open! Bets stay capped until you run all 9.`
    : null;

  function claim() {
    if (claimGrandPrize()) {
      playSound('achievementUnlock');
      void haptics.success();
    }
  }

  function ride() {
    if (letItRide()) {
      playSound('betPlaced');
      void haptics.mediumTap();
      startQuestion();
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Same felt, same house lettering at the same spot as the game table. */}
      <FeltBackdrop feltKey={map.feltKey} casinoName={map.name} />

      {modern ? (
        // The table's HUD, with the back chevron in the map slot and the
        // session tally in the mode line.
        <GameTableHud
          mapName={map.name}
          modeLabel={`Count Sprint · Session ${questionsCorrect}/${questionsAnswered}`}
          leftIcon="chevron-back"
          leftAccessibilityLabel="Leave quiz"
          onOpenMaps={leaveQuiz}
          onOpenSettings={() => setSettingsOpen(true)}
          menuOpen={settingsOpen}
        />
      ) : (
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
      )}

      {modern ? (
        // Rank, streak and flash pace in one strip; the meter takes the nine
        // circles' place, so the medallion goes.
        <QuizSprintStrip
          streak={streak}
          target={QUIZ_STREAK_TARGET}
          checkpoints={QUIZ_CHECKPOINTS}
          rank={quizRankForStreak(streak)}
          cardCount={difficulty.cardCount}
          secondsPerFlash={secondsPerFlash}
          prizeMultiplier={prizeMultiplier}
          pot={pot}
        />
      ) : (
        <>
          <View style={styles.meterRow}>
            <QuizMilestoneBadge streak={streak} />
          </View>

          <QuizStreakMeter
            streak={streak}
            target={QUIZ_STREAK_TARGET}
            checkpoints={QUIZ_CHECKPOINTS}
          />

          {prizeMultiplier > 1 ? (
            <Text style={styles.ridingLine}>
              RIDING ×{prizeMultiplier} — {formatChips(pot)} chips on the line
            </Text>
          ) : null}

          <Text style={styles.difficultyLine}>
            {difficulty.cardCount} cards
            {difficulty.decoyCount > 0
              ? ` · ${difficulty.decoyCount} decoy${difficulty.decoyCount > 1 ? 's' : ''}`
              : ''}
            {` · ${secondsPerFlash}s flash`}
            {difficulty.pairFlash ? ' · pairs' : ''}
          </Text>
        </>
      )}

      {/* The band above the house lettering: the sprint's ♠ marker while
          idle, open felt once the cards are flying. Modern sits its panels
          at the foot of the felt instead. */}
      {modern ? null : (
        <View style={styles.markSlot} pointerEvents="none">
          {phase === 'idle' ? (
            <Animated.View
              style={styles.introIcon}
              entering={reducedMotion ? undefined : FadeInDown.duration(300)}
            >
              <Text style={styles.introIconText}>♠</Text>
            </Animated.View>
          ) : null}
        </View>
      )}

      {/* The stage keeps clear of the lettering below the mark slot: the intro
          copy sits under it, and the flash cards and question land past it. */}
      <View
        style={[
          styles.stage,
          phase === 'idle' && [styles.stageIntro, { paddingBottom: insets.bottom + spacing.lg }],
          modernIntro && styles.stageArcadeIntro,
          !modern && (phase === 'flashing' || phase === 'question') && styles.stageDeal,
          modern &&
            phase === 'flashing' && [
              styles.stageArcadeOpen,
              { paddingBottom: insets.bottom + STAGE_ARCADE_FLASH_LIFT },
            ],
          modern &&
            (phase === 'question' || phase === 'feedback') && [
              styles.stageArcadePanel,
              { paddingBottom: insets.bottom + spacing.lg },
            ],
        ]}
      >
        {modernIntro ? (
          <Animated.View
            style={[styles.introRoom, { paddingBottom: insets.bottom + spacing.lg }]}
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
          >
            <ArcadeLevelBrief
              fit
              kicker={map.name}
              title="Count Sprint"
              body={arcadeBody}
              rules={arcadeRules}
              startLabel="Start Sprint"
              onStart={() => startQuestion()}
            />
          </Animated.View>
        ) : null}
        {phase === 'idle' && !modern ? (
          <Animated.View
            style={[styles.centerBlock, styles.introBlock]}
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
          >
            <Text style={styles.promptTitle}>Count Sprint</Text>
            <Text style={styles.promptBody}>{promptBody}</Text>
            {showPrimer ? (
              <View style={styles.primerBox}>
                <Text style={styles.primerTitle}>HI-LO IN ONE LINE</Text>
                <View style={styles.primerRow}>
                  <View style={styles.primerCell}>
                    <Text style={styles.primerCards}>2–6</Text>
                    <Text style={[styles.primerValue, { color: colors.success }]}>+1</Text>
                  </View>
                  <View style={styles.primerCell}>
                    <Text style={styles.primerCards}>7–9</Text>
                    <Text style={[styles.primerValue, { color: colors.textMuted }]}>0</Text>
                  </View>
                  <View style={styles.primerCell}>
                    <Text style={styles.primerCards}>10–A</Text>
                    <Text style={[styles.primerValue, { color: colors.error }]}>−1</Text>
                  </View>
                </View>
                <Text style={styles.primerHint}>
                  Add them up as the cards flash. Every shuffle starts back at 0.
                </Text>
              </View>
            ) : null}
            {license === 'none' ? (
              <Text style={styles.ladderHint}>
                3 in a row opens the {map.name} table · all 9 unlock full stakes
              </Text>
            ) : null}
            <PrimaryButton label="Start Sprint" onPress={() => startQuestion()} />
          </Animated.View>
        ) : null}

        <QuizFlashStage
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          skin={difficulty.cardSkin}
          underglow={difficulty.underglow}
        />

        {phase === 'question' && modern ? (
          <Animated.View
            style={styles.arcadeBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(250)}
          >
            <SprintPanel>
              <SprintPlaque tab={flashTab} body="What was the count?" small />
              {directEntry ? (
                <Text style={styles.arcadeCaption}>
                  No more choices at this rank — dial in the exact count.
                </Text>
              ) : decoysFlashed > 0 ? (
                <Text style={styles.arcadeCaption}>Remember: face-down decoys are zero.</Text>
              ) : null}
              {directEntry ? (
                <QuizCountEntry onSubmit={(value) => answer(value)} />
              ) : (
                <View style={styles.arcadeGrid}>
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
              )}
            </SprintPanel>
          </Animated.View>
        ) : null}

        {phase === 'feedback' && modern ? (
          <Animated.View
            style={styles.arcadeBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(250)}
          >
            <SprintPanel>
              <SprintPlaque
                tab={rewardReady ? '👑 Grand prize' : 'Count Sprint'}
                body={rewardReady ? 'Unlocked!' : feedbackTitle}
                tone={rewardReady ? 'gold' : wasCorrect ? 'win' : 'lose'}
                small
              />
              {licenseLine ? (
                <Text style={[styles.arcadeCaption, styles.arcadeCaptionGold]}>{licenseLine}</Text>
              ) : null}
              <ArcadeInfoBox>
                The count was{' '}
                <Text style={styles.arcadeInfoValue}>{formatCount(correctAnswer)}</Text>
                {!wasCorrect && selectedChoice !== null ? (
                  <>
                    {' — you picked '}
                    <Text style={styles.arcadeInfoValue}>{formatCount(selectedChoice)}</Text>
                  </>
                ) : null}
                {rideLost ? '. The riding pot is gone — back to a fresh 1,000.' : ''}
              </ArcadeInfoBox>
              {rewardReady ? null : <QuizCountReview flashCards={flashCards} />}
              {rewardReady ? (
                <>
                  <ArcadeButton
                    label={`Claim ${formatChips(pot)} chips`}
                    trailing="▶"
                    variant="gold"
                    size="large"
                    onPress={claim}
                  />
                  {prizeMultiplier < QUIZ_MAX_RIDE_MULTIPLIER ? (
                    <ArcadeButton
                      label={`Let it ride — play for ${formatChips(pot * 2)}`}
                      variant="neutral"
                      size="medium"
                      onPress={ride}
                    />
                  ) : null}
                </>
              ) : (
                <ArcadeButton
                  label="Next cards"
                  trailing="▶"
                  variant="gold"
                  size="large"
                  onPress={() => startQuestion()}
                />
              )}
              <ArcadeButton
                label={licenseEarned ? 'Take your seat at the table' : 'Back to table'}
                variant="neutral"
                size="medium"
                onPress={leaveQuiz}
              />
            </SprintPanel>
          </Animated.View>
        ) : null}

        {phase === 'question' && !modern ? (
          <Animated.View
            style={styles.centerBlock}
            entering={reducedMotion ? undefined : FadeInDown.duration(250)}
          >
            <Text style={styles.promptTitle}>What was the count?</Text>
            {directEntry ? (
              <Text style={styles.promptHint}>
                No more choices at this rank — dial in the exact count.
              </Text>
            ) : difficulty.decoyCount > 0 ? (
              <Text style={styles.promptHint}>Remember: face-down decoys are zero.</Text>
            ) : null}
            {directEntry ? (
              <QuizCountEntry onSubmit={(value) => answer(value)} />
            ) : (
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
            )}
          </Animated.View>
        ) : null}

        {phase === 'feedback' && !modern ? (
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
                {feedbackTitle}
              </Text>
            </Animated.View>

            {licenseLine ? (
              <View style={styles.licenseBanner}>
                <Text style={styles.licenseBannerText}>{licenseLine}</Text>
              </View>
            ) : null}

            <Text style={styles.promptBody}>
              The count was <Text style={styles.answerEmphasis}>{formatCount(correctAnswer)}</Text>
              {!wasCorrect && selectedChoice !== null
                ? ` — you picked ${formatCount(selectedChoice)}`
                : ''}
              {rideLost ? '. The riding pot is gone — back to a fresh 1,000.' : ''}
            </Text>

            <QuizCountReview flashCards={flashCards} />

            {rewardReady ? (
              <>
                <PrimaryButton label={`Claim ${formatChips(pot)} chips`} onPress={claim} />
                {prizeMultiplier < QUIZ_MAX_RIDE_MULTIPLIER ? (
                  <SecondaryButton
                    label={`Let it ride — play for ${formatChips(pot * 2)}`}
                    onPress={ride}
                  />
                ) : null}
              </>
            ) : (
              <PrimaryButton label="Next cards" onPress={() => startQuestion()} />
            )}
            <SecondaryButton
              label={licenseEarned ? 'Take your seat at the table' : 'Back to table'}
              onPress={leaveQuiz}
            />
          </Animated.View>
        ) : null}
      </View>

      <GameToasts levelUpNotice={levelUpNotice} onDismissLevelUp={dismissLevelUp} />
      {modern ? (
        <GameSettingsSheet
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          mapId={map.id}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /** Band between the difficulty line and the house lettering. */
  markSlot: {
    height: 104,
    flexShrink: 1,
    minHeight: 0,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  ridingLine: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  /** Intro copy reads below the house lettering, hugging the bottom. */
  stageIntro: {
    justifyContent: 'flex-end',
  },
  /** Modern: the arcade card fills the whole stage, one page; the room pads itself. */
  stageArcadeIntro: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  introRoom: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  /** Flash cards and the question land past the lettering. */
  stageDeal: {
    paddingTop: STAGE_LETTERING_CLEARANCE,
  },
  /** Modern flash: cards low on the open felt. */
  stageArcadeOpen: {
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  /** Modern question and review: the panel at the foot of the felt. */
  stageArcadePanel: {
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  arcadeBlock: {
    alignSelf: 'stretch',
  },
  arcadeCaption: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    color: colors.arcadeMuted,
    textAlign: 'center',
  },
  arcadeCaptionGold: {
    color: colors.arcadeGold,
  },
  arcadeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: spacing.sm,
    columnGap: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  arcadeInfoValue: {
    fontFamily: fonts.monoMedium,
    color: colors.arcadeGold,
  },
  centerBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  /** Tighter so the whole intro fits between the lettering and the home bar. */
  introBlock: {
    gap: spacing.sm,
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
  licenseBanner: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(224, 185, 77, 0.12)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  licenseBannerText: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    lineHeight: 20,
  },
  primerBox: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: 'rgba(12, 10, 9, 0.55)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primerTitle: {
    color: colors.gold,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
  },
  primerRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  primerCell: {
    alignItems: 'center',
    gap: 2,
  },
  primerCards: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
  primerValue: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  primerHint: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  ladderHint: {
    color: colors.goldDim,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
});
