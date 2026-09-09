import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABLE_FELTS } from '../../assets/registry';
import { mapById } from '../../engine/betting/casino';
import { hiLoValue } from '../../engine/cards/card';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import {
  decksRemainingEstimate,
  DOJO_XP,
  isCheckpointLevel,
  isFlashLevel,
  isFlashLevelDone,
  isStreakLevel,
  levelTutorial,
  QuestionKind,
  speedProfile,
  TableFrame,
  totalCheckpoints,
  trainingLevelSpec,
  trainingLevelsForMap,
  TrainingLevelSpec,
} from '../../engine/dojo';
import { playMeterTopUp, playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useDojoStore } from '../../stores/dojoStore';
import { FLASH_DEBUG_AVAILABLE, useFlashDebugStore } from '../../stores/flashDebugStore';
import { StreakItem, TrainingQuestion, useTrainingStore } from '../../stores/trainingStore';
import { colors, fontSizes, fontWeights, layout, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { PrimaryButton } from '../common/PrimaryButton';
import { FlashCountReview } from '../flash/FlashCountReview';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FlashPanel, FlashPanelChip } from '../flash/FlashPanel';
import {
  FlashTutorialDeck,
  FlashTutorialPanel,
  pileBottom,
  SPREAD_DECK_BOTTOM,
  TUTORIAL_STEPS,
  tutorialStageHeight,
} from '../flash/FlashTutorial';
import { FeltMarkings, feltLetteringHeight } from '../game/FeltMarkings';
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
import { TableStage } from './TableStage';
import { TrainingMeter } from './TrainingMeter';
import { TrueCountStage } from './TrueCountStage';
import { StatusCell, TrainingStatusStrip } from './TrainingStatusStrip';
import { deckLabel, formatAnswer, formatDecks, questionPrompt, kindLabel, missesAllowed, requirementChips } from './copy';

interface TrainingLevelScreenProps {
  readonly mapId: number;
  readonly level: number;
}

const EMPTY_TABLE: TableFrame = { seats: [], dealer: null };

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
  const acknowledgeCountTip = useTrainingStore((state) => state.acknowledgeCountTip);
  const loadedMapId = useTrainingStore((state) => state.mapId);
  const loadedLevel = useTrainingStore((state) => state.level);
  const storeStatus = useTrainingStore((state) => state.status);
  const streak = useTrainingStore((state) => state.streak);
  const resets = useTrainingStore((state) => state.resets);
  const item = useTrainingStore((state) => state.item);
  const itemSerial = useTrainingStore((state) => state.itemSerial);
  const frame = useTrainingStore((state) => state.frame);
  const tally = useTrainingStore((state) => state.tally);
  const cardsSinceCheck = useTrainingStore((state) => state.cardsSinceCheck);
  const question = useTrainingStore((state) => state.question);
  const outcome = useTrainingStore((state) => state.outcome);
  const countTipPending = useTrainingStore((state) => state.countTipPending);
  const meter = useTrainingStore((state) => state.meter);
  const meterDrainMs = useTrainingStore((state) => state.meterDrainMs);
  const timedOut = useTrainingStore((state) => state.timedOut);
  const tableOpen = useDojoStore((state) => state.isMapFlashComplete(mapId));
  const cleared = useDojoStore((state) => isFlashLevelDone(state.flashLevels, mapId, level));

  const [settingsOpen, setSettingsOpen] = useState(false);
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
  // After the primer the deck stays gathered under the slides; without it the ribbon stays out.
  const gathered = inSlides && showPrimer;
  const seated = status !== 'idle';
  // While the table idles the brief and the tutorial are cards on the felt,
  // not a keyboard: the stage keeps only the felt the deck asks for and the
  // card floats centred in the rest instead of hugging the bottom edge. The
  // house lettering is printed under the deck — below the ribbon, or below
  // the gathered pile — and stays off the felt while the primer's beats need
  // the whole strip.
  const letteringHeight = feltLetteringHeight(map.name, width);
  const idleStageHeight =
    inPrimer || gathered ? tutorialStageHeight(width) : SPREAD_DECK_BOTTOM + letteringHeight;
  const idleDeckBottom = gathered ? pileBottom(width) : SPREAD_DECK_BOTTOM;

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
    const wasCorrect = answer(value);
    if (wasCorrect) {
      // The right answer is what tops the meter up: one chime for both,
      // pitched by where the bar now stands (home once it is full).
      playMeterTopUp(useTrainingStore.getState().meter.fill);
      void haptics.success();
    } else {
      playSound('loss');
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

  // Likewise the table is the root screen: unwind to it and switch its map.
  function sitAtTable() {
    router.dismissTo({ pathname: '/game/[mapId]', params: { mapId: String(mapId) } });
  }

  // ---------------------------------------------------------------------------
  // Status strip
  // ---------------------------------------------------------------------------

  const cells: StatusCell[] = [];
  if (checkpointSpec) {
    const total = totalCheckpoints(checkpointSpec);
    const allowed = missesAllowed(checkpointSpec);
    const misses = tally.asked - tally.correct;
    cells.push({
      label: 'CHECKS',
      value: `${tally.correct}`,
      dim: `/${total}`,
      accessibilityLabel: `${tally.correct} of ${total} checks correct`,
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
    const target = streakSpec?.streakTarget ?? 0;
    cells.push({
      label: 'STREAK',
      value: `${streak}`,
      dim: `/${target}`,
      accessibilityLabel: `Streak ${streak} of ${target}`,
    });
    cells.push({
      label: 'RESETS',
      value: `${resets}`,
      tone: resets > 0 ? 'error' : 'gold',
    });
    if (spec.mode === 'cardGroup' && item?.kind === 'cards') {
      cells.push({ label: 'CARDS', value: `${item.cards.length}` });
    }
  }
  cells.push({ label: 'PACE', value: speed.label, accessibilityLabel: `${speed.label} pace` });

  // ---------------------------------------------------------------------------
  // Stage
  // ---------------------------------------------------------------------------

  const revealing = status === 'feedback' || status === 'failed' || status === 'levelComplete';

  function renderStage() {
    if (status === 'idle') {
      return (
        <FlashTutorialDeck beat={inPrimer ? tutorialStep : null} gathered={gathered} width={width} />
      );
    }
    switch (spec.mode) {
      case 'cardValue':
      case 'cardGroup': {
        const cards = item?.kind === 'cards' ? item.cards : [];
        const count = Math.max(1, cards.length);
        const cardWidth =
          count === 1
            ? 96
            : Math.min(74, Math.floor((width - layout.screenPaddingH * 2 - spacing.sm * (count - 1)) / count));
        return (
          <CardsStage
            cards={cards}
            cardWidth={cardWidth}
            speed={speed.animation}
            valueTags={revealing}
            serial={itemSerial}
            caption={spec.mode === 'cardGroup' ? `${cards.length} CARDS` : undefined}
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
            cardWidth={96}
            speed={speed.animation}
            showScale={spec.showDeckScale}
            showProgress={!asksDecks}
          />
        );
      case 'tableCount': {
        const perSeat = [74, 64, 52, 46][Math.min(spec.seats, 4) - 1];
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
    if (status === 'failed') {
      return `Level failed — it was ${right}.`;
    }
    if (!checkpointSpec) {
      return `Not quite — it was ${right}. Streak resets.`;
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
      return (
        <FlashPanel kicker={hasBegun ? `LEVEL ${level}  ·  TRY AGAIN` : `LEVEL ${level}`}>
          <Text style={styles.introTitle}>{spec.title.toUpperCase()}</Text>
          <Text style={styles.introBody}>{spec.brief}</Text>
          <View style={styles.chipRow}>
            {requirementChips(spec).map((chip) => (
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
      return (
        <View style={styles.statusSlot}>
          <Text style={styles.statusText}>
            {spec.mode === 'tableCount' ? 'Count every card on the table…' : 'Keep counting…'}
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
    : `${streakSpec?.streakTarget ?? streak} in a row.`;
  const completeBody = nextSpec ? `Next up: ${nextSpec.title}.` : 'The table is already open.';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Image
        source={TABLE_FELTS[map.feltKey] ?? TABLE_FELTS['gray-suede']}
        style={styles.felt}
        contentFit="cover"
      />
      <View style={styles.feltTint} pointerEvents="none" />

      <GameTableHud
        mapName={map.name}
        modeLabel={`Level ${level} · ${spec.title}`}
        leftIcon="map-outline"
        leftAccessibilityLabel="Level map"
        onOpenMaps={openLevelMap}
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />

      <TrainingStatusStrip cells={cells} />
      {seated ? <TrainingMeter meter={meter} drainMs={meterDrainMs} /> : null}

      <TableCamera
        seated={seated}
        // A fixed height, not a flex basis: Yoga kept the first basis it laid
        // out, so the felt never grew when the primer dealt.
        style={status === 'idle' ? { flex: 0, height: idleStageHeight } : undefined}
      >
        {status !== 'idle' ? (
          <FeltMarkings casinoName={map.name} anchor={0.52} />
        ) : inPrimer ? null : (
          <Animated.View
            key={gathered ? 'pile' : 'ribbon'}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
          >
            <FeltMarkings casinoName={map.name} align="top" topInset={idleDeckBottom} />
          </Animated.View>
        )}
        {renderStage()}
      </TableCamera>

      <View
        style={[
          styles.bottomPanel,
          status === 'idle' && styles.bottomPanelIdle,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        {renderPanel()}
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
          stars={outcome?.stars ?? 1}
          xpAwarded={outcome?.firstClear ? DOJO_XP.flashLevel : 0}
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
  bottomPanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  /** Idle: the brief / primer card floats centred in the felt the deck leaves. */
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
