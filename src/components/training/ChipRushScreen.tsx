import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODERN_TABLE_FELTS, TABLE_FELTS } from '../../assets/registry';
import { mapById } from '../../engine/betting/casino';
import {
  ChipRushLevel,
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
import { frontCard, useChipRushStore } from '../../stores/chipRushStore';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fonts, fontSizes, fontWeights, layout, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';
import { formatChips } from '../../utils/format';
import { ArcadeLevelBrief } from '../arcade/ArcadeLevelBrief';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FlashPanel, FlashPanelChip, FlashPanelStarChip } from '../flash/FlashPanel';
import { GameSettingsSheet } from '../game/GameSettingsSheet';
import { GameTableHud } from '../game/GameTableHud';
import { ChipRushLane, ChipRushTray } from './ChipRushLane';
import { requirementChips, starGlyphs, starTargetsLine } from './copy';
import { LevelTutorialPanel } from './LevelTutorialPanel';
import { StarBankToast } from './StarBankToast';
import { StatusCell, TrainingStatusStrip } from './TrainingStatusStrip';

interface ChipRushScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/**
 * Chip Rush on the casino's felt: true-count cards slide along a lane toward
 * the red edge, and the player drags (or taps) the right bet stack onto the
 * circle for the front card before it escapes. A star per wave.
 */
export function ChipRushScreen({ mapId, level }: ChipRushScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const modern = useModernUi();
  const map = mapById(mapId)!;
  const nextMap = mapById(mapId + 1);
  const nextSpec = trainingLevelsForMap(mapId).find((entry) => entry.level === level + 1) ?? null;

  const state = useChipRushStore();
  const { spec, status, wave, resolved, cards, wavesDone, misses, lastMiss, combo, comboBest } = state;
  const { stars, targets, starBank, outcome } = state;
  const tableOpen = useDojoStore((dojo) => dojo.isMapFlashComplete(mapId));
  const cleared = useDojoStore((dojo) => isFlashLevelDone(dojo.flashLevels, mapId, level));
  const best = useDojoStore((dojo) => dojo.flashBests[flashLevelKey(mapId, level)]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasBegun, setHasBegun] = useState(false);
  const [slidesStep, setSlidesStep] = useState<number | null>(null);
  const [laneWidth, setLaneWidth] = useState(0);

  useEffect(() => {
    useChipRushStore.getState().load(mapId, level);
    return () => {
      useChipRushStore.getState().reset();
    };
  }, [mapId, level]);

  // A card escaping is a miss the player didn't tap for: call it out.
  const missSerial = lastMiss?.serial ?? 0;
  useEffect(() => {
    if (missSerial === 0) {
      return;
    }
    const after = useChipRushStore.getState();
    if (after.status === 'failed' || after.status === 'levelComplete') {
      playSound('strikeOut');
      void haptics.error();
    } else {
      playSound('answerWrong');
      void haptics.warning();
    }
  }, [missSerial]);

  if (!spec) {
    return null;
  }
  // Narrowed once, for the closures below.
  const levelSpec: ChipRushLevel = spec;

  const slides = levelTutorial(mapId, level);
  const seated = status !== 'idle';
  const front = frontCard(cards);

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

  function onBet(units: number) {
    const before = useChipRushStore.getState().stars;
    if (state.bet(units)) {
      playSound(useChipRushStore.getState().stars > before ? 'achievementUnlock' : 'answerRight');
      void haptics.lightTap();
    }
  }

  function onLaneLayout(event: LayoutChangeEvent) {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width !== laneWidth) {
      setLaneWidth(width);
    }
  }

  // ---------------------------------------------------------------------------
  // Status strip
  // ---------------------------------------------------------------------------

  const nextTarget = nextStarTarget(targets, stars);
  const nextStars = starGlyphs(Math.min(STAR_COUNT, stars + 1));
  const cells: StatusCell[] = [
    {
      label: 'WAVES',
      value: `${wavesDone}`,
      dim: `/${nextTarget}`,
      stars: nextStars,
      accessibilityLabel: `${wavesDone} of ${nextTarget} waves toward ${nextStars.length} stars`,
    },
    {
      label: 'STRIKES',
      value: `${Math.min(misses, spec.strikes)}`,
      dim: `/${spec.strikes}`,
      tone: misses > 0 ? 'error' : 'gold',
      accessibilityLabel: `${Math.min(misses, spec.strikes)} of ${spec.strikes} strikes used`,
    },
    { label: 'COMBO', value: `${combo}`, accessibilityLabel: `Combo ${combo}` },
  ];
  const waveShare = spec.cardsPerWave > 0 ? Math.min(1, resolved / spec.cardsPerWave) : 0;

  // ---------------------------------------------------------------------------
  // Bottom panel
  // ---------------------------------------------------------------------------

  function missLine(): string | null {
    if (!lastMiss) {
      return null;
    }
    const tc = formatCount(lastMiss.trueCount);
    const units = `${lastMiss.correct} unit${lastMiss.correct === 1 ? '' : 's'}`;
    return lastMiss.reason === 'escape' ? `Too slow — ${tc} needed ${units}.` : `Not that — ${tc} is ${units}.`;
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
            starUnit="waves"
            rules={[
              ...requirementChips(levelSpec, { starTargets: false }),
              ...(best ? [`Best ${best.run} waves · combo ${best.combo}`] : []),
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
      const miss = missLine();
      return (
        <View style={styles.section}>
          {miss ? <Text style={[styles.feedback, { color: colors.error }]}>{miss}</Text> : null}
          <Text style={styles.hint}>Drag a stack onto the circle (or tap it) to bet on the green-edged card.</Text>
        </View>
      );
    }

    if (status === 'feedback') {
      return (
        <View style={styles.section}>
          <Text style={[styles.feedback, { color: colors.success }]}>Wave {wave + 1} done! The cards speed up…</Text>
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
            wave, the fastest yet — strikes carry over.
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
          <Text style={styles.statusText}>A wrong bet, or a card that reaches the edge, costs a strike.</Text>
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
        modeLabel={`Level ${level} · ${spec.title}`}
        leftIcon="map-outline"
        leftAccessibilityLabel="Level map"
        onOpenMaps={openLevelMap}
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />

      {seated ? <TrainingStatusStrip cells={cells} /> : null}
      {seated ? (
        <View style={styles.waveTrack} accessibilityLabel={`Wave ${wave + 1}, ${resolved} of ${spec.cardsPerWave} cards`}>
          <View style={[styles.waveFill, { width: `${Math.round(waveShare * 100)}%` }]} />
        </View>
      ) : null}

      <View style={styles.body}>
        {seated ? (
          <View style={styles.play}>
            <View onLayout={onLaneLayout}>
              <ChipRushLane cards={cards} frontId={front?.id ?? null} laneWidth={laneWidth} />
            </View>
            <View style={styles.middle}>
              {combo >= 3 ? <Text style={styles.combo}>COMBO ×{combo}</Text> : <Text style={styles.combo}> </Text>}
              <View style={styles.circle}>
                <Text style={styles.circleLabel}>{front ? `BET FOR ${formatCount(front.trueCount)}` : 'BET CIRCLE'}</Text>
                <Text style={styles.circleHint}>drop a stack here</Text>
              </View>
              <Text style={styles.waveLabel}>
                WAVE {Math.min(wave + 1, spec.waves)} OF {spec.waves}
              </Text>
            </View>
            <ChipRushTray disabled={status !== 'playing'} onBet={onBet} />
          </View>
        ) : (
          <View style={styles.play} />
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
          title={`${wavesDone} wave${wavesDone === 1 ? '' : 's'} cleared.`}
          body={nextSpec ? `Next up: ${nextSpec.title}.` : 'The table is already open.'}
          runSummary={comboBest >= 5 ? `best combo ${comboBest}` : undefined}
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
  waveTrack: {
    height: 8,
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.sm,
    borderRadius: 4,
    backgroundColor: colors.overlay,
    overflow: 'hidden',
  },
  waveFill: {
    height: '100%',
    backgroundColor: colors.arcadeGold,
  },
  body: {
    flex: 1,
  },
  play: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  combo: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.arcadeGold,
    includeFontPadding: false,
  },
  circle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.arcadeGold,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  circleLabel: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.arcadeCream,
    includeFontPadding: false,
  },
  circleHint: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  waveLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 2,
  },
  bottomPanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    minHeight: 120,
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
