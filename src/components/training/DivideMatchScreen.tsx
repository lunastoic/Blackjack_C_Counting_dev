import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODERN_TABLE_FELTS, TABLE_FELTS } from '../../assets/registry';
import { mapById } from '../../engine/betting/casino';
import {
  CLEAR_STARS,
  DOJO_XP,
  flashLevelKey,
  isFlashLevelDone,
  formatCountTile,
  levelTutorial,
  nextStarTarget,
  remainingTiles,
  STAR_COUNT,
  trainingLevelsForMap,
} from '../../engine/dojo';
import { useModernUi } from '../../hooks/useModernUi';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useDivideMatchStore } from '../../stores/divideMatchStore';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fonts, fontSizes, fontWeights, layout, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { ArcadeLevelBrief } from '../arcade/ArcadeLevelBrief';
import { PrimaryButton } from '../common/PrimaryButton';
import { SecondaryButton } from '../common/SecondaryButton';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FlashPanel, FlashPanelChip, FlashPanelStarChip } from '../flash/FlashPanel';
import { GameSettingsSheet } from '../game/GameSettingsSheet';
import { GameTableHud } from '../game/GameTableHud';
import { DivideMatchBoard, divideTileWidth } from './DivideMatchBoard';
import { requirementChips, starGlyphs, starTargetsLine } from './copy';
import { LevelTutorialPanel } from './LevelTutorialPanel';
import { StarBankToast } from './StarBankToast';
import { TrainingMeter } from './TrainingMeter';
import { StatusCell, TrainingStatusStrip } from './TrainingStatusStrip';

/** Room under the board for the "GRID 1 OF 3" label and the top inset. */
const BOARD_LABEL_ROOM = 96;

interface DivideMatchScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/**
 * Divide and Match on the casino's felt: the brief, then one grid of count
 * and deck tiles at a time with the target true count over it and the meter
 * draining, and the usual clear / fail / complete beats.
 */
export function DivideMatchScreen({ mapId, level }: DivideMatchScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const modern = useModernUi();
  const map = mapById(mapId)!;
  const nextMap = mapById(mapId + 1);
  const nextSpec = trainingLevelsForMap(mapId).find((entry) => entry.level === level + 1) ?? null;

  const state = useDivideMatchStore();
  const { spec, status, grid, gridSerial, gridIndex, gridsDone, selected, misses, lastMiss } = state;
  const { stars, targets, starBank, outcome, meter, meterDrainMs, timedOut } = state;
  const tableOpen = useDojoStore((dojo) => dojo.isMapFlashComplete(mapId));
  const cleared = useDojoStore((dojo) => isFlashLevelDone(dojo.flashLevels, mapId, level));
  const best = useDojoStore((dojo) => dojo.flashBests[flashLevelKey(mapId, level)]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasBegun, setHasBegun] = useState(false);
  const [slidesStep, setSlidesStep] = useState<number | null>(null);
  const [board, setBoard] = useState({ width: 0, height: 0 });

  useEffect(() => {
    useDivideMatchStore.getState().load(mapId, level);
    return () => {
      useDivideMatchStore.getState().reset();
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
    const after = useDivideMatchStore.getState();
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

  function onDrop(from: number, to: number) {
    feedbackFor(state.drop(from, to));
  }

  function onTap(id: number) {
    const ok = state.tap(id);
    // Picking a tile is just a pick — only a match or a miss makes a sound.
    if (ok && useDivideMatchStore.getState().selected !== null) {
      void haptics.lightTap();
      return;
    }
    feedbackFor(ok);
  }

  function onBoardLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width !== board.width || height !== board.height) {
      setBoard({ width, height });
    }
  }

  // ---------------------------------------------------------------------------
  // Status strip
  // ---------------------------------------------------------------------------

  const total = spec.grids.length;
  const nextTarget = nextStarTarget(targets, stars);
  const nextStars = starGlyphs(Math.min(STAR_COUNT, stars + 1));
  const tilesLeft = grid ? remainingTiles(grid).length : 0;
  const cells: StatusCell[] = [
    {
      label: 'GRIDS',
      value: `${gridsDone}`,
      dim: `/${nextTarget}`,
      stars: nextStars,
      accessibilityLabel: `${gridsDone} of ${nextTarget} grids toward ${nextStars.length} stars`,
    },
    {
      label: 'STRIKES',
      value: `${Math.min(misses, spec.strikes)}`,
      dim: `/${spec.strikes}`,
      tone: misses > 0 ? 'error' : 'gold',
      accessibilityLabel: `${Math.min(misses, spec.strikes)} of ${spec.strikes} strikes used`,
    },
    { label: 'TILES', value: `${tilesLeft}`, accessibilityLabel: `${tilesLeft} tiles on the board` },
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
            starUnit="grids"
            rules={[
              ...requirementChips(levelSpec, { starTargets: false }),
              ...(best ? [`Best ${best.run} grids`] : []),
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
          <Text style={styles.hint}>
            Drag a count onto the deck tile it divides to (or tap one, then the other).{'\n'}Round down — a pair that misses
            the target is a strike.
          </Text>
        </View>
      );
    }

    if (status === 'feedback') {
      return (
        <View style={styles.section}>
          <Text style={[styles.feedback, { color: colors.success }]}>Grid cleared! A new target…</Text>
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
            grid — strikes carry over.
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
              ? 'It drains while the grid is up; every clear tops it up.'
              : 'A pair that doesn’t divide to the target costs a strike.'}
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

  // The box's own padding and the grid label come off before the cards are sized.
  const cardWidth =
    grid && board.width > 0
      ? divideTileWidth(grid, board.width - layout.screenPaddingH * 2, board.height - BOARD_LABEL_ROOM)
      : 0;
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
      {seated ? <TrainingMeter meter={meter} drainMs={meterDrainMs} /> : null}

      <View style={styles.body}>
        {seated && grid ? (
          <View style={styles.boardArea} onLayout={onBoardLayout}>
            <View style={styles.target} accessibilityRole="header">
              <Text style={styles.targetText}>TARGET {formatCountTile(grid.target)}</Text>
            </View>
            {cardWidth > 0 ? (
              <DivideMatchBoard
                grid={grid}
                serial={gridSerial}
                tileWidth={cardWidth}
                selected={selected}
                miss={lastMiss}
                disabled={status !== 'playing'}
                onDrop={onDrop}
                onTap={onTap}
              />
            ) : null}
            <Text style={styles.gridLabel}>
              GRID {Math.min(gridIndex + 1, total)} OF {total}
            </Text>
          </View>
        ) : (
          <View style={styles.boardArea} />
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
          title={`${gridsDone} grid${gridsDone === 1 ? '' : 's'} cleared.`}
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
    gap: spacing.xs,
  },
  target: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    backgroundColor: colors.arcadeGold,
    marginBottom: spacing.xs,
  },
  targetText: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 2,
    color: colors.arcadeInk,
    includeFontPadding: false,
  },
  gridLabel: {
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
