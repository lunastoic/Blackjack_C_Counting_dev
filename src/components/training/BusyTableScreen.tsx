import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODERN_TABLE_FELTS, TABLE_FELTS } from '../../assets/registry';
import { mapById } from '../../engine/betting/casino';
import { Card, hiLoValue } from '../../engine/cards/card';
import {
  CLEAR_STARS,
  DOJO_XP,
  flashLevelKey,
  isFlashLevelDone,
  levelTutorial,
  nextStarTarget,
  STAR_COUNT,
  trainingLevelsForMap,
} from '../../engine/dojo';
import { useCardBack } from '../../hooks/useCardBack';
import { useModernUi } from '../../hooks/useModernUi';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useBusyTableStore } from '../../stores/busyTableStore';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatChips } from '../../utils/format';
import { ArcadeLevelBrief } from '../arcade/ArcadeLevelBrief';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FlashPanel, FlashPanelChip, FlashPanelStarChip } from '../flash/FlashPanel';
import { GameSettingsSheet } from '../game/GameSettingsSheet';
import { GameTableHud } from '../game/GameTableHud';
import { CARD_ASPECT, cardCornerRadius } from '../game/PlayingCard';
import { CardFace } from './CardFace';
import { requirementChips, starGlyphs, starTargetsLine } from './copy';
import { CountEntry } from './CountEntry';
import { LevelTutorialPanel } from './LevelTutorialPanel';
import { StarBankToast } from './StarBankToast';
import { TrainingMeter } from './TrainingMeter';
import { StatusCell, TrainingStatusStrip } from './TrainingStatusStrip';

interface BusyTableScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/** Cards never grow past this, however much felt there is. */
const MAX_CARD_WIDTH = 52;
const CARD_GAP = 4;

/** Hi-Lo value tag under a revealed card. */
function valueTag(card: Card): { text: string; color: string } {
  const value = hiLoValue(card.rank);
  if (value > 0) {
    return { text: '+1', color: colors.trainingPlus };
  }
  if (value < 0) {
    return { text: '−1', color: colors.trainingMinus };
  }
  return { text: '0', color: colors.trainingNeutral };
}

/** One card on the busy table: its face while flashed or revealed, its back otherwise. */
function TableCard({
  card,
  width,
  faceUp,
  showValue,
  back,
}: {
  card: Card;
  width: number;
  faceUp: boolean;
  showValue: boolean;
  back: number;
}) {
  const height = Math.round(width / CARD_ASPECT);
  const tag = showValue ? valueTag(card) : null;
  return (
    <View style={styles.cardSlot}>
      {faceUp ? (
        <CardFace card={card} width={width} />
      ) : (
        <Image
          source={back}
          style={{ width, height, borderRadius: cardCornerRadius(width) }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      )}
      {tag ? <Text style={[styles.valueTag, { color: tag.color }]}>{tag.text}</Text> : null}
    </View>
  );
}

/**
 * Busy Table on the casino's felt: the brief, then one table at a time —
 * flashed face up, flipped face down, the count typed — with the meter
 * draining while the count is asked, a star per stage and the usual
 * clear / fail / complete beats.
 */
export function BusyTableScreen({ mapId, level }: BusyTableScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const modern = useModernUi();
  const back = useCardBack();
  const map = mapById(mapId)!;
  const nextMap = mapById(mapId + 1);
  const nextSpec = trainingLevelsForMap(mapId).find((entry) => entry.level === level + 1) ?? null;

  const state = useBusyTableStore();
  const { spec, status, deal, dealSerial, stageIndex, tablesRight, stagesDone, misses, lastAnswer } = state;
  const { stars, targets, starBank, outcome, meter, meterDrainMs, timedOut } = state;
  const tableOpen = useDojoStore((dojo) => dojo.isMapFlashComplete(mapId));
  const cleared = useDojoStore((dojo) => isFlashLevelDone(dojo.flashLevels, mapId, level));
  const best = useDojoStore((dojo) => dojo.flashBests[flashLevelKey(mapId, level)]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasBegun, setHasBegun] = useState(false);
  const [slidesStep, setSlidesStep] = useState<number | null>(null);

  useEffect(() => {
    useBusyTableStore.getState().load(mapId, level);
    return () => {
      useBusyTableStore.getState().reset();
    };
  }, [mapId, level]);

  if (!spec) {
    return null;
  }
  // Narrowed once, for the closures below.
  const levelSpec = spec;

  const slides = levelTutorial(mapId, level);
  const seated = status !== 'idle';
  const stage = levelSpec.stages[Math.min(stageIndex, levelSpec.stages.length - 1)];

  function openLevelMap() {
    router.dismissTo({ pathname: '/levels/[mapId]', params: { mapId: String(mapId) } });
  }

  function start() {
    // The walkthrough plays itself on a first attempt at a level not yet cleared.
    if (!cleared && !hasBegun && slides.length > 0) {
      setSlidesStep(0);
      return;
    }
    setHasBegun(true);
    state.begin();
  }

  function finishSlides() {
    setSlidesStep(null);
    setHasBegun(true);
    state.begin();
  }

  function onAnswer(value: number) {
    const before = useBusyTableStore.getState().stars;
    const right = state.answer(value);
    const after = useBusyTableStore.getState();
    if (right) {
      playSound(after.stars > before ? 'achievementUnlock' : 'answerRight');
      void haptics.success();
    } else if (after.status === 'failed' || after.status === 'levelComplete') {
      playSound('strikeOut');
      void haptics.error();
    } else {
      playSound('answerWrong');
      void haptics.warning();
    }
  }

  // ---------------------------------------------------------------------------
  // Status strip
  // ---------------------------------------------------------------------------

  const nextTarget = nextStarTarget(targets, stars);
  const nextStars = starGlyphs(Math.min(STAR_COUNT, stars + 1));
  const cells: StatusCell[] = [
    {
      label: 'STAGE',
      value: `${Math.min(stageIndex + 1, levelSpec.stages.length)}`,
      dim: `/${levelSpec.stages.length}`,
      stars: nextStars,
      accessibilityLabel: `Stage ${stageIndex + 1} of ${levelSpec.stages.length}, ${stagesDone} of ${nextTarget} toward ${nextStars.length} stars`,
    },
    {
      label: 'TABLES',
      value: `${tablesRight}`,
      dim: `/${levelSpec.tablesPerStage}`,
      accessibilityLabel: `${tablesRight} of ${levelSpec.tablesPerStage} tables right this stage`,
    },
    {
      label: 'STRIKES',
      value: `${Math.min(misses, levelSpec.strikes)}`,
      dim: `/${levelSpec.strikes}`,
      tone: misses > 0 ? 'error' : 'gold',
      accessibilityLabel: `${Math.min(misses, levelSpec.strikes)} of ${levelSpec.strikes} strikes used`,
    },
  ];

  // ---------------------------------------------------------------------------
  // Board
  // ---------------------------------------------------------------------------

  const revealWrong = status === 'feedback' && lastAnswer !== null && !lastAnswer.right;
  const ended = status === 'failed' || status === 'levelComplete';
  const faceUp = status === 'flashing' || revealWrong || (ended && lastAnswer !== null);
  const showValues = revealWrong || (ended && lastAnswer !== null && !lastAnswer.right);
  // Two seats a row, up to three cards a seat, inside the felt's side padding.
  const boardWidth = width - layout.screenPaddingH * 2;
  const seatWidth = (boardWidth - spacing.md) / 2;
  const cardWidth = Math.floor(Math.min(MAX_CARD_WIDTH, (seatWidth - CARD_GAP * 2 - spacing.sm * 2) / 3));

  function renderHand(cards: readonly Card[], key: string) {
    return (
      <View style={styles.hand} key={key}>
        {cards.map((card, index) => (
          <TableCard
            key={`${key}-${index}-${card.id}`}
            card={card}
            width={cardWidth}
            faceUp={faceUp}
            showValue={showValues}
            back={back}
          />
        ))}
      </View>
    );
  }

  function renderBoard() {
    if (!deal) {
      return null;
    }
    return (
      <Animated.View key={dealSerial} entering={FadeIn.duration(160)} style={styles.board}>
        {status === 'flashing' ? (
          <View style={styles.flashBanner} accessibilityLiveRegion="polite">
            <Text style={styles.flashText}>FLASH — LOOK FAST</Text>
          </View>
        ) : (
          <View style={styles.flashBannerSpace} />
        )}
        <Text style={styles.areaLabel}>DEALER</Text>
        {renderHand(deal.dealer, 'dealer')}
        <View style={styles.seats}>
          {deal.seats.map((cards, index) => (
            <View key={`seat-${index}`} style={[styles.seat, { width: seatWidth }]}>
              {renderHand(cards, `seat-${index}`)}
              <Text style={styles.areaLabel}>SEAT {index + 1}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.stageLabel}>
          STAGE {stageIndex + 1} · {tablesRight}/{levelSpec.tablesPerStage} TABLES · {stage.deckCount} DECKS
        </Text>
      </Animated.View>
    );
  }

  // ---------------------------------------------------------------------------
  // Bottom panel
  // ---------------------------------------------------------------------------

  function renderPanel() {
    if (slidesStep !== null) {
      return (
        <LevelTutorialPanel
          level={level}
          slides={slides}
          step={slidesStep}
          onNext={() => (slidesStep + 1 >= slides.length ? finishSlides() : setSlidesStep(slidesStep + 1))}
          onSkip={finishSlides}
        />
      );
    }
    if (status === 'idle') {
      if (modern) {
        return (
          <ArcadeLevelBrief
            fit
            kicker={hasBegun ? `Level ${level} · Try again` : `Level ${level}`}
            title={levelSpec.title}
            difficulty="Hard"
            body={levelSpec.brief}
            starTargets={targets}
            starUnit="stages"
            rules={[
              ...requirementChips(levelSpec, { starTargets: false }),
              ...(best ? [`Best ${best.run} stages`] : []),
            ]}
            startLabel={hasBegun ? 'Start again' : 'Start training'}
            onStart={start}
            onHow={slides.length > 0 ? () => setSlidesStep(0) : undefined}
          />
        );
      }
      return (
        <FlashPanel
          kicker={hasBegun ? `LEVEL ${level}  ·  TRY AGAIN` : `LEVEL ${level}`}
          kickerAside={<FlashPanelStarChip label={starTargetsLine(levelSpec, targets)} />}
        >
          <Text style={styles.introTitle}>{levelSpec.title.toUpperCase()}</Text>
          <Text style={styles.introBody}>{levelSpec.brief}</Text>
          <View style={styles.chipStack}>
            {requirementChips(levelSpec, { starTargets: false }).map((chip) => (
              <FlashPanelChip key={chip} label={chip} />
            ))}
          </View>
          <PrimaryButton label={hasBegun ? 'Start again' : 'Start training'} onPress={start} />
        </FlashPanel>
      );
    }

    if (status === 'flashing') {
      return (
        <View style={styles.section}>
          <Text style={styles.hint}>Take in the whole table — every seat and the dealer.</Text>
        </View>
      );
    }

    if (status === 'asking') {
      return (
        <View style={styles.section}>
          <Text style={styles.question}>COUNT OF THE WHOLE TABLE?</Text>
          <CountEntry
            step={1}
            min={-20}
            max={20}
            initial={0}
            format={formatCount}
            onSubmit={onAnswer}
            serial={dealSerial}
          />
        </View>
      );
    }

    if (status === 'feedback') {
      if (lastAnswer && !lastAnswer.right && deal) {
        const left = levelSpec.strikes - misses;
        return (
          <View style={styles.section}>
            <Text style={[styles.feedback, { color: colors.error }]}>
              Not quite — the table was {formatCount(deal.count)}.
            </Text>
            <Text style={styles.statusText}>
              {left === 0 ? 'No strikes left.' : left === 1 ? 'Last strike.' : `${left} strikes left.`}
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.section}>
          <Text style={[styles.feedback, { color: colors.success }]}>
            {deal ? `Right — ${formatCount(deal.count)}.` : 'Right.'} Next table…
          </Text>
        </View>
      );
    }

    if (status === 'cleared') {
      const chips = starBank?.chips ?? 0;
      return (
        <View style={styles.section}>
          <Text style={styles.clearedTitle}>Level cleared — {starGlyphs(CLEAR_STARS)}</Text>
          <Text style={styles.statusText}>
            {chips > 0 ? `+${formatChips(chips)} chips. ` : ''}Keep going for {starGlyphs(STAR_COUNT)}? One more stage —
            bigger shoe, shorter flash. Strikes carry over.
          </Text>
          <View style={styles.actionRow}>
            <PrimaryButton label="Keep going" onPress={state.keepGoing} />
            <SecondaryButton label="Stop" onPress={state.stopRun} />
          </View>
        </View>
      );
    }

    if (status === 'failed') {
      return (
        <View style={styles.section}>
          <Text style={[styles.feedback, { color: colors.error }]}>
            {timedOut ? 'Out of time — the meter ran dry.' : 'Out of strikes.'}
          </Text>
          {!timedOut && deal && lastAnswer ? (
            <Text style={styles.statusText}>The table was {formatCount(deal.count)}.</Text>
          ) : (
            <Text style={styles.statusText}>It drains while the count is asked; every right count tops it up.</Text>
          )}
          {stars > 0 ? <Text style={styles.banked}>{starGlyphs(stars)} banked</Text> : null}
          <View style={styles.actionRow}>
            <PrimaryButton label="Try again" onPress={state.begin} />
            <Text style={styles.replayLink} onPress={state.reset} accessibilityRole="button">
              Back to the brief
            </Text>
          </View>
        </View>
      );
    }
    return null;
  }

  const passingBank = starBank && stars < CLEAR_STARS ? starBank : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Image
        source={
          (modern ? MODERN_TABLE_FELTS[map.feltKey] : undefined) ??
          TABLE_FELTS[map.feltKey] ??
          TABLE_FELTS['gray-suede']
        }
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      {modern && MODERN_TABLE_FELTS[map.feltKey] ? null : <View style={styles.feltTint} pointerEvents="none" />}

      <GameTableHud
        mapName={map.name}
        modeLabel={`Level ${level} · ${levelSpec.title}`}
        leftIcon="map-outline"
        leftAccessibilityLabel="Level map"
        onOpenMaps={openLevelMap}
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />

      {seated ? <TrainingStatusStrip cells={cells} /> : null}
      {seated ? <TrainingMeter meter={meter} drainMs={meterDrainMs} /> : null}

      <View style={styles.body}>
        <View style={styles.boardArea}>{seated ? renderBoard() : null}</View>

        <View
          style={[
            styles.bottomPanel,
            status === 'idle' ? styles.bottomPanelIdle : null,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <StarBankToast bank={passingBank} />
          {renderPanel()}
        </View>

        {status === 'idle' && slidesStep === null ? (
          <Animated.View
            style={styles.briefScrim}
            pointerEvents="none"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(300)}
          />
        ) : null}
      </View>

      {status === 'levelComplete' ? (
        <FlashLevelCompleteOverlay
          mapName={map.name}
          level={level}
          stars={stars}
          xpAwarded={outcome?.firstClear ? DOJO_XP.flashLevel : 0}
          chipsAwarded={outcome?.chipsAwarded ?? 0}
          title={`${stagesDone} stage${stagesDone === 1 ? '' : 's'} cleared.`}
          body={nextSpec ? `Next up: ${nextSpec.title}.` : 'The table is already open.'}
          tableUnlocked={(outcome?.tableUnlocked ?? false) && nextMap !== undefined}
          nextMapName={nextMap?.name}
          tableOpen={tableOpen}
          onNextLevel={() =>
            router.replace({
              pathname: '/flash/[mapId]/[level]',
              params: { mapId: String(mapId), level: String(level + 1) },
            })
          }
          onSitAtTable={() => router.dismissTo({ pathname: '/game/[mapId]', params: { mapId: String(mapId) } })}
          onQuiz={() => router.replace({ pathname: '/quiz/[mapId]', params: { mapId: String(mapId) } })}
          onLevelMap={openLevelMap}
          onReplay={state.reset}
        />
      ) : null}

      <GameSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} mapId={mapId} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.sm,
  },
  board: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flashBanner: {
    borderRadius: radii.sm,
    backgroundColor: colors.goldBright,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  flashBannerSpace: {
    height: 24,
    marginBottom: spacing.xs,
  },
  flashText: {
    color: colors.background,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
    letterSpacing: 2,
  },
  areaLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  hand: {
    flexDirection: 'row',
    gap: CARD_GAP,
    justifyContent: 'center',
  },
  cardSlot: {
    alignItems: 'center',
    gap: 2,
  },
  valueTag: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
  },
  seats: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: spacing.md,
    columnGap: spacing.md,
  },
  seat: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  stageLabel: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  bottomPanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    minHeight: 150,
    justifyContent: 'flex-end',
  },
  bottomPanelIdle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 5,
  },
  briefScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  section: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
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
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  banked: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  actionRow: {
    alignSelf: 'stretch',
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  replayLink: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
    textAlign: 'center',
    paddingVertical: spacing.xs,
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
  chipStack: {
    alignItems: 'center',
    gap: spacing.xs,
  },
});
