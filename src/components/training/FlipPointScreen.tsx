import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODERN_TABLE_FELTS, TABLE_FELTS } from '../../assets/registry';
import { mapById } from '../../engine/betting/casino';
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
import { useModernUi } from '../../hooks/useModernUi';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useDojoStore } from '../../stores/dojoStore';
import { useFlipPointStore } from '../../stores/flipPointStore';
import { colors, fontSizes, fontWeights, layout, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatChips } from '../../utils/format';
import { ArcadeLevelBrief } from '../arcade/ArcadeLevelBrief';
import { PrimaryButton } from '../common/PrimaryButton';
import { PressableScale } from '../common/PressableScale';
import { SecondaryButton } from '../common/SecondaryButton';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FlashPanel, FlashPanelChip, FlashPanelStarChip } from '../flash/FlashPanel';
import { GameSettingsSheet } from '../game/GameSettingsSheet';
import { GameTableHud } from '../game/GameTableHud';
import { CardFace } from './CardFace';
import { requirementChips, starGlyphs, starTargetsLine } from './copy';
import { FlipPointSlider } from './FlipPointSlider';
import { LevelTutorialPanel } from './LevelTutorialPanel';
import { StarBankToast } from './StarBankToast';
import { StatusCell, TrainingStatusStrip } from './TrainingStatusStrip';

const CARD_WIDTH = 66;

interface FlipPointScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/**
 * Flip Point on the casino's felt: a hand against the dealer's card, the
 * count slider sweeping beneath it, STOP, and the reveal of where the play
 * really changes — with the usual clear / fail / complete beats.
 */
export function FlipPointScreen({ mapId, level }: FlipPointScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const modern = useModernUi();
  const map = mapById(mapId)!;
  const nextMap = mapById(mapId + 1);
  const nextSpec = trainingLevelsForMap(mapId).find((entry) => entry.level === level + 1) ?? null;

  const state = useFlipPointStore();
  const { spec, status, item, itemSerial, sweepStartedAt, stopValue, lastRight } = state;
  const { handsInSet, setsDone, misses, stars, targets, starBank, outcome, rightTotal } = state;
  const tableOpen = useDojoStore((dojo) => dojo.isMapFlashComplete(mapId));
  const cleared = useDojoStore((dojo) => isFlashLevelDone(dojo.flashLevels, mapId, level));
  const best = useDojoStore((dojo) => dojo.flashBests[flashLevelKey(mapId, level)]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasBegun, setHasBegun] = useState(false);
  const [slidesStep, setSlidesStep] = useState<number | null>(null);

  useEffect(() => {
    useFlipPointStore.getState().load(mapId, level);
    return () => {
      useFlipPointStore.getState().reset();
    };
  }, [mapId, level]);

  // A sweep that runs out is a miss the player didn't tap: give it its sound.
  const ranOut = status === 'reveal' && lastRight === false && stopValue === null;
  useEffect(() => {
    if (ranOut) {
      playSound('answerWrong');
      void haptics.warning();
    }
  }, [ranOut, itemSerial]);

  if (!spec) {
    return null;
  }
  // Narrowed once, for the closures below.
  const levelSpec = spec;

  const slides = levelTutorial(mapId, level);
  const seated = status !== 'idle';

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

  function onStop() {
    const right = state.stop();
    if (right) {
      playSound('answerRight');
      void haptics.success();
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
      label: 'SETS',
      value: `${setsDone}`,
      dim: `/${nextTarget}`,
      stars: nextStars,
      accessibilityLabel: `${setsDone} of ${nextTarget} sets toward ${nextStars.length} stars`,
    },
    {
      label: 'HANDS',
      value: `${handsInSet}`,
      dim: `/${spec.handsPerSet}`,
      accessibilityLabel: `${handsInSet} of ${spec.handsPerSet} hands in this set`,
    },
    {
      label: 'STRIKES',
      value: `${Math.min(misses, spec.strikes)}`,
      dim: `/${spec.strikes}`,
      tone: misses > 0 ? 'error' : 'gold',
      accessibilityLabel: `${Math.min(misses, spec.strikes)} of ${spec.strikes} strikes used`,
    },
  ];

  // ---------------------------------------------------------------------------
  // Bottom panel
  // ---------------------------------------------------------------------------

  function verdictLine(): string {
    if (!item) {
      return '';
    }
    const flip = formatCount(item.play.index);
    if (lastRight) {
      return `Right — the play changes at ${flip}.`;
    }
    if (stopValue === null) {
      return `Too late — the play changes at ${flip}.`;
    }
    return `You stopped at ${formatCount(Math.round(stopValue * 10) / 10)} — it changes at ${flip}.`;
  }

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
            difficulty="Medium"
            body={levelSpec.brief}
            starTargets={targets}
            starUnit="sets"
            rules={[
              ...requirementChips(levelSpec, { starTargets: false }),
              ...(best ? [`Best ${best.run} right`] : []),
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

    if (status === 'sweeping') {
      return (
        <View style={styles.section}>
          <Text style={styles.question}>THE COUNT IS CLIMBING…</Text>
          <PressableScale
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Stop the slider"
            style={styles.stopButton}
          >
            <Text style={styles.stopText}>STOP</Text>
          </PressableScale>
          <Text style={styles.hint}>
            Stop within {levelSpec.tolerance} of the count where the best move changes.
          </Text>
        </View>
      );
    }

    if (status === 'reveal') {
      return (
        <View style={styles.section}>
          <Text style={[styles.feedback, { color: lastRight ? colors.success : colors.error }]}>
            {verdictLine()}
          </Text>
          {item ? (
            <Text style={styles.hint}>
              Below {formatCount(item.play.index)}: {item.play.below}. At {formatCount(item.play.index)} or
              higher: {item.play.action}.
            </Text>
          ) : null}
        </View>
      );
    }

    if (status === 'cleared') {
      const chips = starBank?.chips ?? 0;
      return (
        <View style={styles.section}>
          <Text style={styles.clearedTitle}>Level cleared — {starGlyphs(CLEAR_STARS)}</Text>
          <Text style={styles.statusText}>
            {chips > 0 ? `+${formatChips(chips)} chips. ` : ''}Keep going for {starGlyphs(STAR_COUNT)}? One more
            set — strikes carry over.
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
          <Text style={[styles.feedback, { color: colors.error }]}>Out of strikes.</Text>
          <Text style={styles.statusText}>A stop too far from the flip, or a sweep that runs out, costs a strike.</Text>
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
  const showHand = seated && item && (status === 'sweeping' || status === 'reveal');

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
        modeLabel={`Level ${level} · ${spec.title}`}
        leftIcon="map-outline"
        leftAccessibilityLabel="Level map"
        onOpenMaps={openLevelMap}
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />

      {seated ? <TrainingStatusStrip cells={cells} /> : null}

      <View style={styles.body}>
        <View style={styles.stageArea}>
          {showHand && item ? (
            <>
              <Text style={styles.label}>{item.play.label.toUpperCase()}</Text>
              <View style={styles.handRow}>
                <View style={styles.cards}>
                  {item.playerCards.map((card) => (
                    <CardFace key={card.id} card={card} width={CARD_WIDTH} />
                  ))}
                </View>
                <Text style={styles.vs}>VS</Text>
                <CardFace card={item.dealerUp} width={CARD_WIDTH} />
              </View>
              <View style={styles.sliderSlot}>
                <FlipPointSlider
                  serial={itemSerial}
                  sweepStartedAt={sweepStartedAt}
                  sweepMs={spec.sweepMs}
                  stopValue={stopValue}
                  revealed={status === 'reveal'}
                  index={item.play.index}
                  below={item.play.below}
                  action={item.play.action}
                />
              </View>
            </>
          ) : null}
        </View>

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
          title={`${setsDone} set${setsDone === 1 ? '' : 's'} · ${rightTotal} flips found.`}
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
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
    gap: spacing.md,
  },
  label: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    letterSpacing: 2,
  },
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  vs: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    letterSpacing: 2,
  },
  sliderSlot: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  bottomPanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    minHeight: 170,
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
  question: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
    textAlign: 'center',
  },
  stopButton: {
    alignSelf: 'stretch',
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    backgroundColor: '#A82A25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: {
    color: colors.arcadeCream,
    fontSize: 34,
    fontWeight: fontWeights.heavy,
    letterSpacing: 4,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
    lineHeight: 20,
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
