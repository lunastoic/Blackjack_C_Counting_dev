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
  decisionLabel,
  DECISION,
  DOJO_XP,
  flashLevelKey,
  isFlashLevelDone,
  levelTutorial,
  nextStarTarget,
  STAR_COUNT,
  swipeComboMultiplier,
  SwipeDirection,
  trainingLevelsForMap,
} from '../../engine/dojo';
import { useModernUi } from '../../hooks/useModernUi';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useDojoStore } from '../../stores/dojoStore';
import { useSwipeStrategyStore } from '../../stores/swipeStrategyStore';
import { colors, fonts, fontSizes, fontWeights, layout, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { ArcadeLevelBrief } from '../arcade/ArcadeLevelBrief';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FlashPanel, FlashPanelChip, FlashPanelStarChip } from '../flash/FlashPanel';
import { GameSettingsSheet } from '../game/GameSettingsSheet';
import { GameTableHud } from '../game/GameTableHud';
import { ChoiceGrid } from './AnswerPads';
import { requirementChips, starGlyphs, starTargetsLine } from './copy';
import { LevelTutorialPanel } from './LevelTutorialPanel';
import { StarBankToast } from './StarBankToast';
import { SwipeStrategyHand } from './SwipeStrategyHand';
import { TrainingMeter } from './TrainingMeter';
import { StatusCell, TrainingStatusStrip } from './TrainingStatusStrip';

interface SwipeStrategyScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/** Hand cards on the swipe slab. */
const HAND_CARD_WIDTH = 72;

/** The four direction labels around the hand, and their colours. */
const ARROWS: readonly {
  readonly direction: SwipeDirection;
  readonly label: string;
  readonly color: string;
}[] = [
  { direction: 'up', label: '↑ DOUBLE', color: colors.arcadeGold },
  { direction: 'left', label: '← HIT', color: colors.arcadeMint },
  { direction: 'right', label: 'STAND →', color: '#FF8A80' },
  { direction: 'down', label: '↓ SPLIT', color: '#8CB8F0' },
];

const FALLBACK_CHOICES = [DECISION.hit, DECISION.stand, DECISION.double, DECISION.split];

/**
 * Swipe Strategy on the casino's felt: the brief, then waves of hands to
 * swipe with the meter draining over them, a star per wave, and the usual
 * clear / fail / complete beats.
 */
export function SwipeStrategyScreen({ mapId, level }: SwipeStrategyScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const modern = useModernUi();
  const map = mapById(mapId)!;
  const nextMap = mapById(mapId + 1);
  const nextSpec = trainingLevelsForMap(mapId).find((entry) => entry.level === level + 1) ?? null;

  const state = useSwipeStrategyStore();
  const { spec, status, item, itemSerial, wave, handsInWave, wavesDone, misses, lastAnswer } = state;
  const { combo, stars, targets, starBank, outcome, meter, meterDrainMs, timedOut, rightAnswers } = state;
  const tableOpen = useDojoStore((dojo) => dojo.isMapFlashComplete(mapId));
  const cleared = useDojoStore((dojo) => isFlashLevelDone(dojo.flashLevels, mapId, level));
  const best = useDojoStore((dojo) => dojo.flashBests[flashLevelKey(mapId, level)]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasBegun, setHasBegun] = useState(false);
  const [slidesStep, setSlidesStep] = useState<number | null>(null);

  useEffect(() => {
    useSwipeStrategyStore.getState().load(mapId, level);
    return () => {
      useSwipeStrategyStore.getState().reset();
    };
  }, [mapId, level]);

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

  function feedbackFor(ok: boolean) {
    const after = useSwipeStrategyStore.getState();
    if (ok) {
      playSound(after.stars > stars ? 'achievementUnlock' : 'answerRight');
      void haptics.lightTap();
    } else if (after.status === 'failed' || after.status === 'levelComplete') {
      playSound('strikeOut');
      void haptics.error();
    } else {
      playSound('answerWrong');
      void haptics.warning();
    }
  }

  function onSwipe(direction: SwipeDirection) {
    feedbackFor(state.swipe(direction));
  }

  function onButton(code: number) {
    feedbackFor(state.answer(code));
  }

  // ---------------------------------------------------------------------------
  // Status strip
  // ---------------------------------------------------------------------------

  const nextTarget = nextStarTarget(targets, stars);
  const nextStars = starGlyphs(Math.min(STAR_COUNT, stars + 1));
  const cells: StatusCell[] = [
    {
      label: 'WAVE',
      value: `${Math.min(wave + 1, levelSpec.waves)}`,
      dim: `/${nextTarget}`,
      stars: nextStars,
      accessibilityLabel: `Wave ${Math.min(wave + 1, levelSpec.waves)}, ${wavesDone} of ${nextTarget} waves toward ${nextStars.length} stars`,
    },
    {
      label: 'HANDS',
      value: `${handsInWave}`,
      dim: `/${levelSpec.handsPerWave}`,
      accessibilityLabel: `${handsInWave} of ${levelSpec.handsPerWave} hands this wave`,
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
            difficulty="Easy"
            body={levelSpec.brief}
            starTargets={targets}
            starUnit="waves"
            rules={[
              ...requirementChips(levelSpec, { starTargets: false }),
              ...(best ? [`Best ${best.run} right · combo ${best.combo}`] : []),
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

    if (status === 'playing') {
      return (
        <View style={styles.section}>
          <Text style={styles.question}>SWIPE YOUR PLAY</Text>
          <ChoiceGrid
            choices={FALLBACK_CHOICES}
            selected={null}
            correct={item?.correct ?? DECISION.hit}
            disabled={false}
            format={decisionLabel}
            onPress={onButton}
          />
        </View>
      );
    }

    if (status === 'feedback' && lastAnswer && item) {
      return (
        <View style={styles.section}>
          <Text style={[styles.feedback, { color: colors.error }]}>
            Not {decisionLabel(lastAnswer.code).toLowerCase()} — {item.reason}
          </Text>
          <Text style={styles.statusText}>
            {levelSpec.strikes - misses === 1 ? 'Last strike.' : `${levelSpec.strikes - misses} strikes left.`}
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
            {chips > 0 ? `+${formatChips(chips)} chips. ` : ''}Keep going for {starGlyphs(STAR_COUNT)}? One more
            wave — strikes carry over.
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
          <Text style={styles.statusText}>
            {timedOut
              ? 'It drains while a hand is up; every right swipe tops it up.'
              : item && lastAnswer
                ? `It was ${decisionLabel(lastAnswer.correct).toLowerCase()} — ${item.reason}`
                : 'A wrong swipe costs a strike.'}
          </Text>
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
  const multiplier = swipeComboMultiplier(combo);

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
        {seated && item ? (
          <View style={styles.playArea}>
            <Text style={styles.combo}>{multiplier > 1 ? `COMBO ×${multiplier}` : ' '}</Text>
            {ARROWS.map((arrow) => (
              <Text
                key={arrow.direction}
                style={[styles.arrow, styles[arrow.direction], { color: arrow.color, borderColor: arrow.color }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {arrow.label}
              </Text>
            ))}
            <SwipeStrategyHand
              item={item}
              serial={itemSerial}
              cardWidth={HAND_CARD_WIDTH}
              disabled={status !== 'playing'}
              onSwipe={onSwipe}
            />
          </View>
        ) : (
          <View style={styles.playArea} />
        )}

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
          title={`${wavesDone} wave${wavesDone === 1 ? '' : 's'} · ${rightAnswers} right.`}
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
  playArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
  },
  combo: {
    position: 'absolute',
    top: spacing.sm,
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.arcadeGold,
  },
  arrow: {
    position: 'absolute',
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    overflow: 'hidden',
  },
  up: {
    top: 48,
  },
  down: {
    bottom: spacing.sm,
  },
  left: {
    left: layout.screenPaddingH,
    top: '55%',
  },
  right: {
    right: layout.screenPaddingH,
    top: '55%',
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
