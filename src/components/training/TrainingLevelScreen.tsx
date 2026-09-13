import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODERN_TABLE_FELTS, TABLE_FELTS } from '../../assets/registry';
import { mapById } from '../../engine/betting/casino';
import { hiLoValue } from '../../engine/cards/card';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import {
  CLEAR_STARS,
  decksRemainingEstimate,
  DOJO_XP,
  isCheckpointLevel,
  isClearingStars,
  isFlashLevel,
  isFlashLevelDone,
  isStreakLevel,
  levelTutorial,
  nextStarTarget,
  QuestionKind,
  speedProfile,
  STAR_COUNT,
  TableFrame,
  trainingLevelSpec,
  trainingLevelsForMap,
  TrainingLevelSpec,
} from '../../engine/dojo';
import { useModernUi } from '../../hooks/useModernUi';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useDojoStore } from '../../stores/dojoStore';
import { FLASH_DEBUG_AVAILABLE, useFlashDebugStore } from '../../stores/flashDebugStore';
import { StreakItem, TrainingQuestion, useTrainingStore } from '../../stores/trainingStore';
import { colors, fontSizes, fontWeights, layout, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatChips } from '../../utils/format';
import { ArcadeLevelBrief } from '../arcade/ArcadeLevelBrief';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { FlashCountReview } from '../flash/FlashCountReview';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FlashPanel, FlashPanelChip, FlashPanelStarChip } from '../flash/FlashPanel';
import {
  FlashTutorialDeck,
  FlashTutorialPanel,
  SPREAD_DECK_BOTTOM,
  TUTORIAL_STEPS,
  tutorialStageHeight,
} from '../flash/FlashTutorial';
import { FeltMarkings, feltLetteringHeight } from '../game/FeltMarkings';
import { DEALT_CARD_WIDTH } from '../game/PlayingCard';
import { GameSettingsSheet } from '../game/GameSettingsSheet';
import { GameTableHud } from '../game/GameTableHud';
import { TableCamera } from '../game/TableCamera';
import { AccuracyRows, accuracyRows } from './AccuracyRows';
import { ChoiceGrid, CountPad } from './AnswerPads';
import { CardsStage } from './CardsStage';
import { CountEntry } from './CountEntry';
import { CountStreamStage } from './CountStreamStage';
import { DeckEstimateStage } from './DeckEstimateStage';
import { LevelTutorialPanel } from './LevelTutorialPanel';
import { StarBankToast } from './StarBankToast';
import { TableStage } from './TableStage';
import { TRAINING_METER_HEIGHT, TrainingMeter } from './TrainingMeter';
import { TrueCountStage } from './TrueCountStage';
import { StatusCell, TRAINING_STRIP_HEIGHT, TrainingStatusStrip } from './TrainingStatusStrip';
import {
  deckLabel,
  formatAnswer,
  formatDecks,
  questionPrompt,
  kindLabel,
  missesAllowed,
  requirementChips,
  starGlyphs,
  starTargetsLine,
  stretchLine,
  stretchRulesLine,
} from './copy';

interface TrainingLevelScreenProps {
  readonly mapId: number;
  readonly level: number;
}

const EMPTY_TABLE: TableFrame = { seats: [], dealer: null };

/** Card width on the value drills; groups deal the same card until the row can't fit. */
const SINGLE_CARD_WIDTH = DEALT_CARD_WIDTH;

/** Exact-entry bounds, matching the four-choice ranges in the store. */
const ENTRY_BOUNDS: Record<QuestionKind, { min: number; max: number }> = {
  runningCount: { min: -40, max: 40 },
  decksRemaining: { min: 0.5, max: 8 },
  trueCount: { min: -20, max: 20 },
};

function streakPrompt(spec: TrainingLevelSpec): string {
  switch (spec.mode) {
    case 'cardValue':
      return 'CARD VALUE?';
    case 'cardGroup':
      return 'NET VALUE OF THE GROUP?';
    case 'deckEstimate':
      return 'HOW MANY DECKS REMAIN?';
    case 'trueCount':
      return 'WHAT’S THE TRUE COUNT?';
    default:
      return '';
  }
}

/** The kind a streak item answers, for formatting. */
function streakKind(item: StreakItem | null): QuestionKind {
  return item?.kind === 'deckEstimate' ? 'decksRemaining' : 'runningCount';
}

/**
 * One training level at one casino. The felt, HUD, dealer and hands are the
 * live table's own components; the bottom panel is the level brief, the
 * question, and the feedback. The only clock is the answer meter under the
 * status strip.
 */
export function TrainingLevelScreen({ mapId, level }: TrainingLevelScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const map = mapById(mapId);
  const valid = map !== undefined && isFlashLevel(level);

  const load = useTrainingStore((state) => state.load);
  const reset = useTrainingStore((state) => state.reset);
  const begin = useTrainingStore((state) => state.begin);
  const answer = useTrainingStore((state) => state.answer);
  const continueAfterMiss = useTrainingStore((state) => state.continueAfterMiss);
  const keepGoing = useTrainingStore((state) => state.keepGoing);
  const stopRun = useTrainingStore((state) => state.stopRun);
  const acknowledgeCountTip = useTrainingStore((state) => state.acknowledgeCountTip);
  const loadedMapId = useTrainingStore((state) => state.mapId);
  const loadedLevel = useTrainingStore((state) => state.level);
  const storeStatus = useTrainingStore((state) => state.status);
  const streak = useTrainingStore((state) => state.streak);
  const misses = useTrainingStore((state) => state.misses);
  const item = useTrainingStore((state) => state.item);
  const itemSerial = useTrainingStore((state) => state.itemSerial);
  const frame = useTrainingStore((state) => state.frame);
  const tally = useTrainingStore((state) => state.tally);
  const cardsSinceCheck = useTrainingStore((state) => state.cardsSinceCheck);
  const question = useTrainingStore((state) => state.question);
  const outcome = useTrainingStore((state) => state.outcome);
  const stars = useTrainingStore((state) => state.stars);
  const pace = useTrainingStore((state) => state.pace);
  const paceIsBest = useTrainingStore((state) => state.paceIsBest);
  const targets = useTrainingStore((state) => state.targets);
  const starBank = useTrainingStore((state) => state.starBank);
  const stretch = useTrainingStore((state) => state.stretch);
  const countTipPending = useTrainingStore((state) => state.countTipPending);
  const meter = useTrainingStore((state) => state.meter);
  const meterDrainMs = useTrainingStore((state) => state.meterDrainMs);
  const timedOut = useTrainingStore((state) => state.timedOut);
  const tableOpen = useDojoStore((state) => state.isMapFlashComplete(mapId));
  const cleared = useDojoStore((state) => isFlashLevelDone(state.flashLevels, mapId, level));

  const [settingsOpen, setSettingsOpen] = useState(false);
  const modern = useModernUi();
  const tutorialEveryLevel = useFlashDebugStore((state) => state.tutorialEveryLevel);
  // Idle felt: the ribbon spread, the Hi-Lo primer beats, or the level's own slides.
  const [idleStage, setIdleStage] = useState<'spread' | 'primer' | 'slides'>('spread');
  const [tutorialStep, setTutorialStep] = useState(0);
  const [hasBegun, setHasBegun] = useState(false);

  useEffect(() => {
    if (valid) {
      load(mapId, level);
    }
    return () => {
      reset();
    };
  }, [valid, mapId, level, load, reset]);

  // Until the store points at this level, the felt reads as idle.
  const synced = loadedMapId === mapId && loadedLevel === level;
  const status = synced ? storeStatus : 'idle';

  // Whenever the table returns to idle (fail, replay), the ribbon lies back out.
  const [prevStatus, setPrevStatus] = useState(status);
  if (prevStatus !== status) {
    setPrevStatus(status);
    if (status === 'idle') {
      setIdleStage('spread');
      setTutorialStep(0);
    }
  }

  // A star banked in passing (the first): a pill over the felt. The second
  // pauses the run on its own panel and the third ends it, so neither needs one.
  const passingBank = synced && starBank && !isClearingStars(starBank.stars) ? starBank : null;
  const lastStarChips = starBank?.chips ?? 0;

  // Casino distractions: the house calls the results out loud.
  const settled = frame?.beat === 'settle' ? frame : null;
  useEffect(() => {
    if (!settled) {
      return;
    }
    const results = settled.table.seats.flatMap((seat) => seat.results);
    if (results.some((result) => result === 'win' || result === 'blackjack')) {
      playSound('win');
    } else if (results.some((result) => result === 'push')) {
      playSound('push');
    } else if (results.length > 0) {
      playSound('loss');
    }
  }, [settled]);

  if (!map || !isFlashLevel(level)) {
    return <Redirect href="/" />;
  }

  const spec = trainingLevelSpec(mapId, level);
  const speed = speedProfile(spec.speed);
  const checkpointSpec = isCheckpointLevel(spec) ? spec : null;
  const streakSpec = isStreakLevel(spec) ? spec : null;
  const isExam = checkpointSpec?.mode === 'tableCount' && checkpointSpec.exam;
  const chipSetKey = map.chipSetKey;
  const seatStake = map.chipDenominations[0];
  const nextSpec = trainingLevelsForMap(mapId).find((entry) => entry.level === level + 1) ?? null;
  const asksDecks = checkpointSpec?.questions.includes('decksRemaining') ?? false;
  const totalCards = checkpointSpec ? checkpointSpec.deckCount * CARDS_PER_DECK : 0;
  // The tutorial is the Hi-Lo values primer — only before the very first level
  // of the game (or every level in dev) — followed by the level's own slides.
  // It plays itself on the first start of a level not yet cleared; the brief
  // keeps a replay link after that.
  const forceEveryLevel = FLASH_DEBUG_AVAILABLE && tutorialEveryLevel;
  const showPrimer = (mapId === 1 && level === 1) || forceEveryLevel;
  const slides = levelTutorial(mapId, level);
  const autoTutorial = !cleared || forceEveryLevel;
  const inPrimer = status === 'idle' && idleStage === 'primer';
  const inSlides = status === 'idle' && idleStage === 'slides';
  // The brief is up: the table behind it goes a shade darker until Start.
  const briefUp = status === 'idle' && idleStage === 'spread';
  // After the primer the deck stays gathered under the slides; without it the ribbon stays out.
  const gathered = inSlides && showPrimer;
  const seated = status !== 'idle';
  // While the table idles the brief and the tutorial are cards on the felt,
  // not a keyboard: the stage keeps only the felt the deck asks for and the
  // card floats centred in the rest instead of hugging the bottom edge. The
  // house lettering is printed just below the deck — ribbon or pile — and
  // stays in the open through primer, slides and run; the primer deals its
  // beats onto the felt under the print, so it asks for that strip too.
  const letteringHeight = feltLetteringHeight(map.name, width, modern);
  const idleStageHeight = inPrimer
    ? tutorialStageHeight(letteringHeight, width)
    : SPREAD_DECK_BOTTOM + letteringHeight;
  // Sitting down pushes the felt under the meter — and, in Modern, under the
  // status strip the brief kept hidden. The print climbs by the same amount
  // so it never moves on screen.
  const seatedDrop = TRAINING_METER_HEIGHT + (modern ? TRAINING_STRIP_HEIGHT : 0);
  const letteringInset = SPREAD_DECK_BOTTOM - (seated ? seatedDrop : 0);

  function startTutorial() {
    setTutorialStep(0);
    if (showPrimer) {
      playSound('shuffle');
      setIdleStage('primer');
    } else if (slides.length > 0) {
      setIdleStage('slides');
    } else {
      finishTutorial();
    }
  }

  function handleBegin() {
    if (autoTutorial && !hasBegun) {
      startTutorial();
      return;
    }
    setHasBegun(true);
    begin();
  }

  function finishTutorial() {
    setHasBegun(true);
    begin();
  }

  /** The primer hands over to the level's slides, or deals when there are none. */
  function finishPrimer() {
    if (slides.length === 0) {
      finishTutorial();
      return;
    }
    setTutorialStep(0);
    setIdleStage('slides');
  }

  function handleAnswer(value: number) {
    const before = useTrainingStore.getState().stars;
    const wasCorrect = answer(value);
    const after = useTrainingStore.getState();
    if (wasCorrect) {
      // The answer that banks a star rings the chime instead of the pop.
      playSound(after.stars > before ? 'achievementUnlock' : 'answerRight');
      void haptics.success();
    } else if (after.status === 'failed' || after.status === 'levelComplete') {
      // The miss that ends the run: the whoosh instead of the error.
      playSound('strikeOut');
      void haptics.error();
    } else {
      playSound('answerWrong');
      void haptics.warning();
    }
  }

  function goToLevel(nextLevel: number) {
    router.replace({
      pathname: '/flash/[mapId]/[level]',
      params: { mapId: String(mapId), level: String(nextLevel) },
    });
  }

  // The level map is normally the screen under this one: pop back to it
  // instead of stacking another copy (each keeps six posters decoded). From a
  // deep link there is none, and dismissTo swaps this screen for it.
  function openLevelMap() {
    router.dismissTo({ pathname: '/levels/[mapId]', params: { mapId: String(mapId) } });
  }

  // Likewise the table: unwind to it if it's below, else take its place here.
  function sitAtTable() {
    router.dismissTo({ pathname: '/game/[mapId]', params: { mapId: String(mapId) } });
  }

  // ---------------------------------------------------------------------------
  // Status strip
  // ---------------------------------------------------------------------------

  // Progress reads against the next star's target: "14/21 ★★".
  const nextTarget = nextStarTarget(targets, stars);
  const nextStars = starGlyphs(Math.min(STAR_COUNT, stars + 1));
  const cells: StatusCell[] = [];
  if (checkpointSpec) {
    const allowed = missesAllowed(checkpointSpec);
    const misses = tally.asked - tally.correct;
    cells.push({
      label: 'CHECKS',
      value: `${tally.asked}`,
      dim: `/${nextTarget}`,
      stars: nextStars,
      accessibilityLabel: `${tally.asked} of ${nextTarget} checks toward ${nextStars.length} stars`,
    });
    cells.push({
      label: 'MISSES',
      value: `${misses}`,
      dim: allowed > 0 ? `/${allowed}` : undefined,
      tone: misses > 0 ? 'error' : 'gold',
      accessibilityLabel: allowed > 0 ? `${misses} of ${allowed} misses allowed` : `${misses} misses`,
    });
    cells.push({
      label: checkpointSpec.deckCount === 1 ? 'DECK' : 'DECKS',
      value: `${checkpointSpec.deckCount}`,
      locked: true,
      accessibilityLabel: `${checkpointSpec.deckCount} deck, fixed`,
    });
  } else {
    const strikes = streakSpec?.strikes ?? 0;
    cells.push({
      label: 'RIGHT',
      value: `${streak}`,
      dim: `/${nextTarget}`,
      stars: nextStars,
      accessibilityLabel: `${streak} of ${nextTarget} right toward ${nextStars.length} stars`,
    });
    cells.push(
      strikes > 0
        ? {
            label: 'STRIKES',
            // The miss that ends the run is one past the strikes: show them all used.
            value: `${Math.min(misses, strikes)}`,
            dim: `/${strikes}`,
            tone: misses > 0 ? 'error' : 'gold',
            accessibilityLabel: `${Math.min(misses, strikes)} of ${strikes} strikes used`,
          }
        : {
            label: 'STRIKES',
            value: 'NONE',
            locked: true,
            accessibilityLabel: 'No strikes: a miss ends the run',
          },
    );
    if (spec.mode === 'cardGroup' && item?.kind === 'cards') {
      cells.push({ label: 'CARDS', value: `${item.cards.length}` });
    }
  }
  cells.push({ label: 'PACE', value: speed.label, accessibilityLabel: `${speed.label} pace` });

  // ---------------------------------------------------------------------------
  // Stage
  // ---------------------------------------------------------------------------

  const revealing =
    status === 'feedback' || status === 'cleared' || status === 'failed' || status === 'levelComplete';

  function renderStage() {
    if (status === 'idle') {
      return (
        <FlashTutorialDeck
          beat={inPrimer ? tutorialStep : null}
          gathered={gathered}
          width={width}
          letteringHeight={letteringHeight}
        />
      );
    }
    switch (spec.mode) {
      case 'cardValue':
      case 'cardGroup': {
        const cards = item?.kind === 'cards' ? item.cards : [];
        const count = Math.max(1, cards.length);
        // Every group deals the single-card size; only a row too wide for the
        // screen shrinks, and then just enough to fit.
        const cardWidth = Math.min(
          SINGLE_CARD_WIDTH,
          Math.floor((width - layout.screenPaddingH * 2 - spacing.sm * (count - 1)) / count),
        );
        return (
          <CardsStage
            cards={cards}
            cardWidth={cardWidth}
            speed={speed.animation}
            valueTags={revealing}
            serial={itemSerial}
            caption={spec.mode === 'cardGroup' ? `${cards.length} CARDS` : undefined}
            missed={question?.wasCorrect === false}
          />
        );
      }
      case 'deckEstimate':
        return item?.kind === 'deckEstimate' ? (
          <DeckEstimateStage
            item={item.item}
            showScale={spec.showDeckScale}
            reveal={revealing}
            serial={itemSerial}
          />
        ) : null;
      case 'trueCount':
        return item?.kind === 'trueCount' ? (
          <TrueCountStage item={item.item} reveal={revealing} serial={itemSerial} />
        ) : null;
      case 'countStream':
        return (
          <CountStreamStage
            frame={frame}
            totalCards={totalCards}
            cardWidth={SINGLE_CARD_WIDTH}
            speed={speed.animation}
            showScale={spec.showDeckScale}
            showProgress={!asksDecks}
          />
        );
      case 'tableCount': {
        const perSeat = [70, 60, 49, 43][Math.min(spec.seats, 4) - 1];
        const cardWidth = Math.max(40, Math.min(perSeat, Math.floor((width - 120) / spec.seats / 1.7)));
        return (
          <TableStage
            table={frame?.table ?? EMPTY_TABLE}
            seatCount={spec.seats}
            cardWidth={cardWidth}
            speed={speed.animation}
            distractions={spec.distractions}
            chipSetKey={chipSetKey}
            stake={seatStake}
            piles={{
              drawn: frame?.cardsDrawn ?? 0,
              remaining: frame?.cardsRemaining ?? totalCards,
              totalCards,
              showScale: spec.showDeckScale,
            }}
          />
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Bottom panel
  // ---------------------------------------------------------------------------

  function renderInput(current: TrainingQuestion | null) {
    const selected = current?.selected ?? null;
    const disabled = status !== 'asking';
    if (!checkpointSpec) {
      if (!item) {
        return null;
      }
      const correct = item.kind === 'cards' ? item.correct : item.item.correct;
      if (item.kind === 'cards') {
        return (
          <CountPad
            bound={item.cards.length}
            selected={selected}
            correct={correct}
            disabled={disabled}
            format={formatCount}
            onPress={handleAnswer}
          />
        );
      }
      return (
        <ChoiceGrid
          choices={item.item.choices}
          selected={selected}
          correct={correct}
          disabled={disabled}
          format={(value) => formatAnswer(streakKind(item), value)}
          onPress={handleAnswer}
        />
      );
    }
    if (!current) {
      return null;
    }
    const format = (value: number) => formatAnswer(current.kind, value);
    if (checkpointSpec.answerInput === 'entry') {
      const bounds = ENTRY_BOUNDS[current.kind];
      return (
        <CountEntry
          step={current.kind === 'runningCount' ? 1 : 0.5}
          min={bounds.min}
          max={current.kind === 'decksRemaining' ? checkpointSpec.deckCount : bounds.max}
          initial={current.kind === 'decksRemaining' ? Math.max(0.5, checkpointSpec.deckCount / 2) : 0}
          format={format}
          onSubmit={handleAnswer}
          serial={question ? question.partIndex + tally.asked * 8 : 0}
        />
      );
    }
    return (
      <ChoiceGrid
        choices={current.choices}
        selected={selected}
        correct={current.correct}
        disabled={disabled}
        format={format}
        onPress={handleAnswer}
      />
    );
  }

  /** The arithmetic behind a missed check, so the trainee can re-sync. */
  function renderReview(current: TrainingQuestion) {
    if (!checkpointSpec || !frame) {
      return null;
    }
    switch (current.kind) {
      case 'runningCount': {
        const startCount =
          current.correct - cardsSinceCheck.reduce((sum, card) => sum + hiLoValue(card.rank), 0);
        return cardsSinceCheck.length > 0 ? (
          <FlashCountReview cards={cardsSinceCheck} startCount={startCount} />
        ) : null;
      }
      case 'decksRemaining':
        return (
          <Text style={styles.reviewText}>
            {frame.cardsRemaining} cards left ≈ {formatDecks(current.correct)} decks
          </Text>
        );
      case 'trueCount': {
        const decks = decksRemainingEstimate(frame.cardsRemaining);
        return (
          <Text style={styles.reviewText}>
            {formatCount(frame.runningCount)} ÷ {formatDecks(decks)} decks = {formatCount(current.correct)}
          </Text>
        );
      }
    }
  }

  function feedbackLine(current: TrainingQuestion): string {
    const kind = checkpointSpec ? current.kind : streakKind(item);
    const right = formatAnswer(kind, current.correct);
    if (current.wasCorrect) {
      return `Correct — ${right}`;
    }
    if (status === 'failed' || status === 'levelComplete') {
      return checkpointSpec ? `Run over — it was ${right}.` : `Out of strikes — it was ${right}.`;
    }
    if (!checkpointSpec) {
      const left = (streakSpec?.strikes ?? 0) - misses;
      const strikes = left === 1 ? 'Last strike.' : `${left} strikes left.`;
      return `Not quite — it was ${right}. ${strikes}`;
    }
    return `Not quite — it was ${right}. Pick the count up from here.`;
  }

  function renderPanel() {
    if (inPrimer) {
      return (
        <FlashTutorialPanel
          step={tutorialStep}
          lastLabel={slides.length > 0 ? 'Next' : undefined}
          onNext={() =>
            tutorialStep + 1 >= TUTORIAL_STEPS ? finishPrimer() : setTutorialStep((step) => step + 1)
          }
          onSkip={finishTutorial}
        />
      );
    }

    if (inSlides) {
      return (
        <LevelTutorialPanel
          level={level}
          slides={slides}
          step={tutorialStep}
          onNext={() =>
            tutorialStep + 1 >= slides.length ? finishTutorial() : setTutorialStep((step) => step + 1)
          }
          onSkip={finishTutorial}
        />
      );
    }

    if (status === 'idle') {
      // Modern: the brief is the arcade card over the felt (see below).
      if (modern) {
        return null;
      }
      return (
        <FlashPanel
          kicker={hasBegun ? `LEVEL ${level}  ·  TRY AGAIN` : `LEVEL ${level}`}
          kickerAside={<FlashPanelStarChip label={starTargetsLine(spec, targets)} />}
        >
          <Text style={styles.introTitle}>{spec.title.toUpperCase()}</Text>
          <Text style={styles.introBody}>{spec.brief}</Text>
          <View style={styles.chipStack}>
            {requirementChips(spec, { starTargets: false }).map((chip) => (
              <FlashPanelChip key={chip} label={chip} />
            ))}
            <FlashPanelChip label={`${speed.label} pace`} />
          </View>
          <View style={styles.introActions}>
            <PrimaryButton label={hasBegun ? 'Start again' : 'Start training'} onPress={handleBegin} />
            {/* Start plays the tutorial itself on a first attempt; otherwise it is a tap away. */}
            {(showPrimer || slides.length > 0) && (hasBegun || !autoTutorial) ? (
              <Text style={styles.replayLink} onPress={startTutorial} accessibilityRole="button">
                How this level works
              </Text>
            ) : null}
          </View>
        </FlashPanel>
      );
    }

    if (status === 'running') {
      const fresh = stretch && frame === null;
      return (
        <View style={styles.statusSlot}>
          <Text style={styles.statusText}>
            {fresh
              ? 'New shoe — the count starts at 0.'
              : spec.mode === 'tableCount'
                ? 'Count every card on the table…'
                : 'Keep counting…'}
          </Text>
        </View>
      );
    }

    if (status === 'asking') {
      const prompt = checkpointSpec && question ? questionPrompt(question.kind, question.isFinal) : streakPrompt(spec);
      return (
        <View style={styles.questionSection}>
          {question && question.givens.length > 0 ? (
            <View style={styles.chipRow}>
              {question.givens.map((given) => (
                <FlashPanelChip
                  key={given.kind}
                  label={`${kindLabel(given.kind)} ${formatAnswer(given.kind, given.correct)} ✓`}
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.question}>{prompt}</Text>
          {renderInput(question)}
        </View>
      );
    }

    // The meter ran dry mid-question: no answer to correct, just the restart.
    if (status === 'failed' && timedOut) {
      return (
        <View style={styles.questionSection}>
          <Text style={[styles.feedback, { color: colors.error }]}>Out of time — the meter ran dry.</Text>
          <Text style={styles.statusText}>
            It drains while a question is open; every right answer tops it up.
          </Text>
          {stars > 0 ? <Text style={styles.banked}>{starGlyphs(stars)} banked</Text> : null}
          <View style={styles.actionRow}>
            <PrimaryButton label="Try again" onPress={begin} />
            <Text style={styles.replayLink} onPress={reset} accessibilityRole="button">
              Back to the brief
            </Text>
          </View>
        </View>
      );
    }

    if (!question) {
      return null;
    }

    // The second star: the level is cleared and the run pauses here.
    if (status === 'cleared') {
      return (
        <View style={styles.questionSection}>
          <Text style={[styles.feedback, { color: question.wasCorrect ? colors.success : colors.error }]}>
            {feedbackLine(question)}
          </Text>
          {checkpointSpec && question.wasCorrect === false ? renderReview(question) : null}
          <Text style={styles.clearedTitle}>Level cleared — {starGlyphs(CLEAR_STARS)}</Text>
          <Text style={styles.statusText}>
            {lastStarChips > 0 ? `+${formatChips(lastStarChips)} chips. ` : ''}
            Keep going for {starGlyphs(STAR_COUNT)}? {stretchLine(spec, targets)} {stretchRulesLine(spec)}
          </Text>
          <View style={styles.actionRow}>
            <PrimaryButton label="Keep going" onPress={keepGoing} />
            <SecondaryButton label="Stop" onPress={stopRun} />
          </View>
        </View>
      );
    }

    // feedback / failed / levelComplete
    const scorecard = isExam && status === 'failed' ? accuracyRows(tally) : null;
    return (
      <View style={styles.questionSection}>
        <Text style={[styles.feedback, { color: question.wasCorrect ? colors.success : colors.error }]}>
          {feedbackLine(question)}
        </Text>
        {checkpointSpec ? (
          <>
            {question.wasCorrect === false ? renderReview(question) : null}
            {scorecard ? <AccuracyRows rows={scorecard} /> : null}
            {status === 'feedback' && question.wasCorrect === false ? (
              <View style={styles.actionRow}>
                <PrimaryButton label="Continue" onPress={continueAfterMiss} />
              </View>
            ) : null}
          </>
        ) : (
          renderInput(question)
        )}
        {status === 'failed' ? (
          <View style={styles.actionRow}>
            {stars > 0 ? <Text style={styles.banked}>{starGlyphs(stars)} banked</Text> : null}
            <PrimaryButton label="Try again" onPress={begin} />
            <Text style={styles.replayLink} onPress={reset} accessibilityRole="button">
              Back to the brief
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  const completeTitle = checkpointSpec
    ? isExam
      ? 'Certified card counter.'
      : `${tally.correct} of ${tally.asked} checks.`
    : misses === 0
      ? `${streak} in a row.`
      : `${streak} right, ${misses === 1 ? 'one strike' : `${misses} strikes`}.`;
  const nextUp = nextSpec ? `Next up: ${nextSpec.title}.` : 'The table is already open.';
  // Short of the third star, say what it takes; the level map shows the best.
  const completeBody = stars < STAR_COUNT ? `${stretchLine(spec, targets)} ${nextUp}` : nextUp;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* The same felt as the game table: Modern's carries its own vignette, Classic's takes the tint. */}
      <Image
        source={
          (modern ? MODERN_TABLE_FELTS[map.feltKey] : undefined) ??
          TABLE_FELTS[map.feltKey] ??
          TABLE_FELTS['gray-suede']
        }
        style={styles.felt}
        contentFit="cover"
      />
      {modern && MODERN_TABLE_FELTS[map.feltKey] ? null : (
        <View style={styles.feltTint} pointerEvents="none" />
      )}

      <GameTableHud
        mapName={map.name}
        modeLabel={`Level ${level} · ${spec.title}`}
        leftIcon="map-outline"
        leftAccessibilityLabel="Level map"
        onOpenMaps={openLevelMap}
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />

      {/* The Modern brief carries the stars, strikes and pace itself, and needs
          the strip's height to stay one page. */}
      {modern && status === 'idle' ? null : <TrainingStatusStrip cells={cells} />}
      {seated ? <TrainingMeter meter={meter} drainMs={meterDrainMs} /> : null}

      {/* The felt and the panel share one box so the Modern brief can lie
          over both — the deck stays dealt underneath, ready for the primer. */}
      <View style={styles.body}>
        <TableCamera
          // Training never pulls up a chair: that move belongs to the game
          // table's Deal. The stage holds the seated (1×) frame throughout —
          // the standing pull-back is a scale transform, which resamples every
          // card face on the felt and reads as a soft print at drill size.
          seated
          // A fixed height, not a flex basis: Yoga kept the first basis it laid
          // out, so the felt never grew when the primer dealt.
          style={status === 'idle' ? { flex: 0, height: idleStageHeight } : undefined}
        >
          {/* The house print is part of the felt, like on the game table: it
              sits under the deck's band and never moves — the dealt cards
              land on top of it. In play the dashboard pushes the felt down,
              so the print climbs to match. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <FeltMarkings
              casinoName={map.name}
              align="top"
              topInset={letteringInset}
              modern={modern}
            />
          </View>
          {renderStage()}
        </TableCamera>

        {/* Modern skips the scrim: the felt stays the table's own, edge to edge. */}
        {briefUp && !modern ? (
          <Animated.View
            style={styles.briefScrim}
            pointerEvents="none"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(300)}
          />
        ) : null}

        <View
          style={[
            styles.bottomPanel,
            status === 'idle' ? styles.bottomPanelIdle : styles.bottomPanelSeated,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <StarBankToast bank={passingBank} />
          {renderPanel()}
        </View>

        {modern && briefUp ? (
          <Animated.View
            style={[styles.briefOverlay, { paddingBottom: insets.bottom + spacing.xs }]}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
          >
            <ArcadeLevelBrief
              fit
              kicker={hasBegun ? `Level ${level} · Try again` : `Level ${level}`}
              title={spec.title}
              difficulty={speed.label}
              body={spec.brief}
              starTargets={targets}
              starUnit={checkpointSpec ? 'checks' : 'right'}
              rules={requirementChips(spec, { starTargets: false })}
              startLabel={hasBegun ? 'Start again' : 'Start training'}
              onStart={handleBegin}
              // Always a tap away, even when Start plays it itself on a first attempt.
              onHow={showPrimer || slides.length > 0 ? startTutorial : undefined}
            />
          </Animated.View>
        ) : null}
      </View>

      {countTipPending ? (
        <View style={styles.tipOverlay}>
          <FlashPanel kicker="KEEP COUNTING" style={styles.tipCard}>
            <Text style={styles.tipTitle}>The count carries on.</Text>
            <Text style={styles.tipBody}>
              {checkpointSpec ? deckLabel(checkpointSpec.deckCount) : 'One deck'}, no reshuffle. Every
              card you’ve seen still counts — keep adding from where you left off.
            </Text>
            <PrimaryButton label="Okay" onPress={acknowledgeCountTip} />
          </FlashPanel>
        </View>
      ) : null}

      {status === 'levelComplete' ? (
        <FlashLevelCompleteOverlay
          mapName={map.name}
          level={level}
          stars={stars}
          xpAwarded={outcome?.firstClear ? DOJO_XP.flashLevel : 0}
          chipsAwarded={outcome?.chipsAwarded ?? 0}
          pace={pace}
          paceIsBest={paceIsBest}
          title={completeTitle}
          body={completeBody}
          scorecard={isExam ? accuracyRows(tally) : undefined}
          tableUnlocked={outcome?.tableUnlocked ?? false}
          tableOpen={tableOpen}
          onNextLevel={() => goToLevel(level + 1)}
          onSitAtTable={sitAtTable}
          onQuiz={() =>
            router.replace({ pathname: '/quiz/[mapId]', params: { mapId: String(mapId) } })
          }
          onLevelMap={openLevelMap}
          onReplay={reset}
        />
      ) : null}

      <GameSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mapId={mapId}
      />
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
  },
  feltTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayLight,
  },
  body: {
    flex: 1,
  },
  bottomPanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  /** Modern: the brief lies over the felt and the panel slot together, one page. */
  briefOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenPaddingH,
    // The panel starts just above the house print, where the spread ribbon
    // ends — the ribbon shows in full above it, as the cards do in play.
    paddingTop: SPREAD_DECK_BOTTOM - spacing.xs,
  },
  /**
   * In play the question and its answers ride a little above the bottom edge —
   * lifted in place, so the felt and the cards above keep their layout.
   */
  bottomPanelSeated: {
    transform: [{ translateY: -(spacing.xxxl + spacing.xxl) }],
  },
  /** Idle: the brief / primer card floats centred in the felt the deck leaves. */
  briefScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  bottomPanelIdle: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  introTitle: {
    color: colors.goldBright,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    letterSpacing: 2,
    textAlign: 'center',
  },
  introBody: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: 22,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // The brief's rules read one under the other: stars, then strikes, then pace.
  chipStack: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  introActions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  replayLink: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  statusSlot: {
    minHeight: 120,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  questionSection: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  question: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
    textAlign: 'center',
  },
  feedback: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  clearedTitle: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
    textAlign: 'center',
  },
  banked: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  reviewText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  actionRow: {
    alignSelf: 'stretch',
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  tipOverlay: {
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
  tipCard: {
    width: '86%',
    maxWidth: 360,
  },
  tipTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  tipBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 21,
  },
});
