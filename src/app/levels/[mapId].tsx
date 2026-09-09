import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appAssets, MAP_ART } from '../../assets/registry';
import { PressableScale } from '../../components/common/PressableScale';
import { FEATURES } from '../../constants/features';
import { LevelPath } from '../../components/levels/LevelPath';
import { CASINO_MAPS, CasinoMap, mapById } from '../../engine/betting/casino';
import { FLASH_LEVELS_PER_MAP, FlashProgress, nextFlashLevel } from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useDojoStore } from '../../stores/dojoStore';
import {
  debugCompleteMap,
  debugCompleteNextLevel,
  debugResetLevelsAndMaps,
  FLASH_DEBUG_AVAILABLE,
  useFlashDebugStore,
} from '../../stores/flashDebugStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { colors, fontSizes, fontWeights, layout, radii, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';

const AnimatedImage = Animated.createAnimatedComponent(Image);

/** Card takes most of the width; the neighbours peek in from the edges. */
const CARD_WIDTH_RATIO = 0.8;
const CARD_GAP = spacing.md;
/** Card height is capped so it reads as a card, not a full-screen panel. */
const CARD_MAX_HEIGHT = 600;

/** Unlock reveal: the screen settles, the new card slides to centre… */
const REVEAL_SCROLL_DELAY_MS = 350;
/** …holds a beat, the lock swings open… */
const REVEAL_HOLD_MS = 450;
const REVEAL_SWAP_MS = 250;
/** …shows the open lock, then the pane lifts and the ladder fades in. */
const REVEAL_SWAP_HOLD_MS = 900;
const REVEAL_LIFT_MS = 550;

/** A card's look: locked pane → lock open (pane still up) → ladder showing. */
type RevealStage = 'locked' | 'unlocking' | 'open';

/** One breath of the Play Table glow, in and out. */
const PULSE_MS = 1100;

/**
 * Select Map: one casino card at a time, swipe to slide between them. Each
 * card carries its art, its bet ceiling, and the six-level training ladder;
 * table + quiz open once the ladder is cleared.
 */
export default function LevelMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mapId } = useLocalSearchParams<{ mapId: string }>();
  const parsed = Number(mapId);
  const initialIndex = Math.max(
    0,
    CASINO_MAPS.findIndex((map) => map.id === parsed),
  );
  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);
  const snap = cardWidth + CARD_GAP;
  const sidePadding = (width - cardWidth) / 2;

  const [active, setActive] = useState(initialIndex);
  const [pagedTo, setPagedTo] = useState(initialIndex);
  // Cards fill the pager's height exactly — measured, since a horizontal list
  // gives its rows no height of their own.
  const [pagerHeight, setPagerHeight] = useState(0);
  const listRef = useRef<FlatList<CasinoMap>>(null);

  // Re-page when the route param changes while the screen stays mounted.
  if (pagedTo !== initialIndex) {
    setPagedTo(initialIndex);
    setActive(initialIndex);
  }
  useEffect(() => {
    listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
  }, [initialIndex]);

  const progress = useDojoStore((state) => state.flashLevels);
  const unlockedMapIds = useProgressionStore((state) => state.unlockedMapIds);
  const debugUnlockAll = useFlashDebugStore((state) => FLASH_DEBUG_AVAILABLE && state.unlockAll);

  // A casino that unlocked since the last visit keeps its locked look until
  // this screen is in front, then slides to centre and plays its unlock.
  const isFocused = useIsFocused();
  const pendingReveal = useProgressionStore((state) => state.pendingRevealMapId);
  const clearMapReveal = useProgressionStore((state) => state.clearMapReveal);
  const [revealing, setRevealing] = useState<number | null>(null);
  const finishReveal = useCallback(() => setRevealing(null), []);

  useEffect(() => {
    if (!isFocused || pendingReveal === null) {
      return;
    }
    const index = CASINO_MAPS.findIndex((map) => map.id === pendingReveal);
    const timer = setTimeout(() => {
      // Hand the card over from the store's flag to this screen's own state.
      setRevealing(index < 0 ? null : pendingReveal);
      clearMapReveal();
      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, animated: true });
        setActive(index);
      }
    }, REVEAL_SCROLL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isFocused, pendingReveal, clearMapReveal]);

  if (!Number.isInteger(parsed) || !mapById(parsed)) {
    return <Redirect href={{ pathname: '/levels/[mapId]', params: { mapId: '1' } }} />;
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / snap);
    setActive(Math.min(Math.max(index, 0), CASINO_MAPS.length - 1));
  }

  function openLevel(map: CasinoMap, level: number) {
    router.push({
      pathname: '/flash/[mapId]/[level]',
      params: { mapId: String(map.id), level: String(level) },
    });
  }

  // The table is the root screen: pop back to it (switching its map) rather
  // than stacking a fresh table on top of this map and the one before it —
  // every screen left in the stack keeps its felt and posters in memory.
  function openTable(map: CasinoMap) {
    router.dismissTo({ pathname: '/game/[mapId]', params: { mapId: String(map.id) } });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Select Map</Text>
        <PressableScale
          accessibilityLabel="Settings, stats and achievements"
          onPress={() => router.push('/settings')}
          style={styles.headerButton}
        >
          <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <FlatList
        ref={listRef}
        style={styles.pager}
        onLayout={(event: LayoutChangeEvent) =>
          setPagerHeight(Math.floor(event.nativeEvent.layout.height))
        }
        data={CASINO_MAPS}
        horizontal
        snapToInterval={snap}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{ paddingHorizontal: sidePadding, alignItems: 'center' }}
        getItemLayout={(_, index) => ({ length: snap, offset: snap * index, index })}
        onMomentumScrollEnd={onScrollEnd}
        keyExtractor={(map) => String(map.id)}
        renderItem={({ item, index }) => (
          <MapCard
            map={item}
            width={cardWidth}
            height={Math.min(Math.max(0, pagerHeight - spacing.md), CARD_MAX_HEIGHT)}
            isActive={index === active}
            isLast={index === CASINO_MAPS.length - 1}
            progress={progress}
            unlocked={unlockedMapIds.includes(item.id) || debugUnlockAll}
            unlockAll={debugUnlockAll}
            reveal={item.id === revealing || item.id === pendingReveal}
            onRevealed={finishReveal}
            onSelectLevel={(level) => openLevel(item, level)}
            onTable={() => openTable(item)}
            onQuiz={() =>
              router.push({ pathname: '/quiz/[mapId]', params: { mapId: String(item.id) } })
            }
          />
        )}
      />

      {FLASH_DEBUG_AVAILABLE ? (
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>DEV</Text>
          <Text
            style={styles.devLink}
            onPress={() => debugCompleteNextLevel(CASINO_MAPS[active].id)}
            accessibilityRole="button"
          >
            +1 level
          </Text>
          <Text
            style={styles.devLink}
            onPress={() => debugCompleteMap(CASINO_MAPS[active].id)}
            accessibilityRole="button"
          >
            Clear map
          </Text>
          <Text
            style={styles.devLink}
            onPress={debugResetLevelsAndMaps}
            accessibilityRole="button"
          >
            Reset all
          </Text>
        </View>
      ) : null}

      <View style={styles.dots} accessibilityLabel={`Casino ${active + 1} of ${CASINO_MAPS.length}`}>
        {CASINO_MAPS.map((map, index) => (
          <PressableScale
            key={map.id}
            accessibilityLabel={map.name}
            onPress={() => listRef.current?.scrollToIndex({ index, animated: true })}
            style={[styles.dot, index === active && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

interface MapCardProps {
  readonly map: CasinoMap;
  readonly width: number;
  readonly height: number;
  readonly isActive: boolean;
  readonly isLast: boolean;
  readonly progress: FlashProgress;
  readonly unlocked: boolean;
  readonly unlockAll: boolean;
  /** Just unlocked: keep the locked look and play the reveal once centred. */
  readonly reveal: boolean;
  readonly onRevealed: () => void;
  readonly onSelectLevel: (level: number) => void;
  readonly onTable: () => void;
  readonly onQuiz: () => void;
}

function MapCard({
  map,
  width,
  height,
  isActive,
  isLast,
  progress,
  unlocked,
  unlockAll,
  reveal,
  onRevealed,
  onSelectLevel,
  onTable,
  onQuiz,
}: MapCardProps) {
  const reducedMotion = useReducedMotion();
  const next = nextFlashLevel(progress, map.id);
  const tableOpen = next === null;
  const remaining = next === null ? 0 : FLASH_LEVELS_PER_MAP - next + 1;
  const previous = mapById(map.id - 1);
  const pathWidth = width - spacing.md * 2;
  // The ladder is laid out to whatever height is left under the banner — no scrolling.
  const [pathHeight, setPathHeight] = useState(0);

  function onPathLayout(event: LayoutChangeEvent) {
    setPathHeight(Math.floor(event.nativeEvent.layout.height));
  }

  // Unlock reveal. The pane and closed lock sit over the whole card; once the
  // card is centred the lock crossfades to the open one with a little pop,
  // then the pane lifts while the ladder and table button fade in beneath.
  const revealing = unlocked && reveal;
  const [revealStage, setRevealStage] = useState<RevealStage>('locked');
  const stage: RevealStage = !unlocked ? 'locked' : !reveal ? 'open' : revealStage;
  const paneOpacity = useSharedValue(unlocked && !reveal ? 0 : 1);
  const lockOpacity = useSharedValue(1);
  const unlockOpacity = useSharedValue(0);
  const lockScale = useSharedValue(1);
  const contentOpacity = useSharedValue(unlocked && !reveal ? 1 : 0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (revealing) {
      return; // the reveal sequence below owns the values
    }
    // Settle instantly: closed pane when locked (or re-locked by a dev reset),
    // ladder showing when already open.
    clearTimers();
    paneOpacity.set(unlocked ? 0 : 1);
    lockOpacity.set(1);
    unlockOpacity.set(0);
    lockScale.set(1);
    contentOpacity.set(unlocked ? 1 : 0);
  }, [revealing, unlocked, clearTimers, paneOpacity, lockOpacity, unlockOpacity, lockScale, contentOpacity]);

  // Once the revealing card is centred the sequence runs to the end, even if
  // the player swipes on; a second arming while it runs is ignored.
  const armed = revealing && isActive;
  useEffect(() => {
    if (!armed || timersRef.current.length > 0) {
      return;
    }
    const timers = timersRef.current;
    timers.push(
      setTimeout(() => {
        setRevealStage('unlocking');
        playSound('achievementUnlock');
        void haptics.success();
        if (reducedMotion) {
          lockOpacity.set(0);
          unlockOpacity.set(1);
          return;
        }
        lockOpacity.set(withTiming(0, { duration: REVEAL_SWAP_MS }));
        unlockOpacity.set(withTiming(1, { duration: REVEAL_SWAP_MS }));
        lockScale.set(
          withSequence(
            withTiming(1.25, { duration: 180, easing: Easing.out(Easing.quad) }),
            withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) }),
          ),
        );
      }, REVEAL_HOLD_MS),
    );
    timers.push(
      setTimeout(() => {
        if (reducedMotion) {
          paneOpacity.set(0);
          contentOpacity.set(1);
          return;
        }
        paneOpacity.set(withTiming(0, { duration: REVEAL_LIFT_MS }));
        contentOpacity.set(withTiming(1, { duration: REVEAL_LIFT_MS }));
      }, REVEAL_HOLD_MS + REVEAL_SWAP_HOLD_MS),
    );
    timers.push(
      setTimeout(() => {
        timersRef.current = [];
        // Reset for any later reveal; the card reads 'open' from `reveal` dropping.
        setRevealStage('locked');
        onRevealed();
      }, REVEAL_HOLD_MS + REVEAL_SWAP_HOLD_MS + REVEAL_LIFT_MS),
    );
  }, [armed, reducedMotion, onRevealed, paneOpacity, lockOpacity, unlockOpacity, lockScale, contentOpacity]);

  const paneStyle = useAnimatedStyle(() => ({ opacity: paneOpacity.value }));
  const lockStyle = useAnimatedStyle(() => ({
    opacity: lockOpacity.value,
    transform: [{ scale: lockScale.value }],
  }));
  const unlockStyle = useAnimatedStyle(() => ({
    opacity: unlockOpacity.value,
    transform: [{ scale: lockScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  const locked = stage === 'locked';
  const levelsDone = next === null ? FLASH_LEVELS_PER_MAP : next - 1;

  // The open table breathes a soft gold glow so it's the obvious next tap.
  const pulse = useSharedValue(0);
  const playable = tableOpen && stage === 'open';
  useEffect(() => {
    if (playable && !reducedMotion) {
      pulse.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(pulse);
      pulse.set(playable ? 0.6 : 0);
    }
    return () => cancelAnimation(pulse);
  }, [playable, reducedMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + pulse.value * 0.6,
    shadowRadius: 8 + pulse.value * 10,
    transform: [{ scale: 1 + pulse.value * 0.015 }],
  }));

  // Tapping a lock that can't open yet rattles it side to side.
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  function rattleLock() {
    void haptics.warning();
    if (reducedMotion) {
      return;
    }
    shakeX.set(
      withSequence(
        withTiming(-10, { duration: 55 }),
        withTiming(10, { duration: 70 }),
        withTiming(-7, { duration: 70 }),
        withTiming(7, { duration: 70 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      ),
    );
  }

  return (
    <View
      style={[
        styles.card,
        { width, height, marginRight: isLast ? 0 : CARD_GAP },
        !isActive && styles.cardInactive,
      ]}
    >
      {/* Square art box as tall as the card, centred: the whole skyline shows, sides crop. */}
      <Image
        source={MAP_ART[map.artKey]}
        style={[styles.art, { width: height, height, left: (width - height) / 2 }]}
        contentFit="cover"
      />
      {/* Locked casino: a dark pane and the lock cover the whole card; the
          ladder stays hidden until the previous casino is cleared. The banner
          stays readable above it. */}
      {stage !== 'open' ? (
        <Animated.View style={[styles.lockPane, paneStyle]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${map.name} locked — finish level ${FLASH_LEVELS_PER_MAP} at ${previous?.name ?? 'the previous casino'}`}
            disabled={!locked}
            hitSlop={spacing.md}
            onPress={rattleLock}
          >
            <Animated.View style={[styles.lockBody, shakeStyle]}>
              <View style={styles.lockBadge}>
                <AnimatedImage
                  source={appAssets.icons.lock}
                  style={[styles.lockIcon, lockStyle]}
                  contentFit="contain"
                />
                <AnimatedImage
                  source={appAssets.icons.unlock}
                  style={[styles.lockIcon, styles.lockIconOver, unlockStyle]}
                  contentFit="contain"
                />
              </View>
              <Text style={styles.lockText}>{locked ? 'Table locked' : 'Unlocked'}</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}

      <View style={styles.banner}>
        <View style={styles.nameRow}>
          {locked ? <Ionicons name="lock-closed" size={16} color={colors.textSecondary} /> : null}
          <Text style={styles.mapName} numberOfLines={1}>
            {map.name}
          </Text>
        </View>

        {tableOpen && !locked && FEATURES.mapCardQuiz ? (
          <View style={styles.modeRow}>
            <PressableScale
              accessibilityLabel={`Quiz mode at ${map.name}`}
              onPress={onQuiz}
              style={[styles.modeButton, styles.modeButtonQuiz]}
            >
              <Ionicons name="flash" size={16} color={colors.goldBright} />
              <Text style={[styles.modeButtonText, styles.modeButtonQuizText]}>Quiz</Text>
            </PressableScale>
          </View>
        ) : (
          <Text style={styles.meta} numberOfLines={1}>
            {locked
              ? `Finish level ${FLASH_LEVELS_PER_MAP} at ${previous?.name ?? 'the previous casino'}`
              : tableOpen
                ? `All ${FLASH_LEVELS_PER_MAP} levels cleared · max bet ${formatChips(map.maxBet)}`
                : `${remaining} level${remaining === 1 ? '' : 's'} to open the table · max bet ${formatChips(map.maxBet)}`}
          </Text>
        )}
      </View>

      <View style={styles.pathWrap} onLayout={onPathLayout}>
        {!locked && pathHeight > 0 ? (
          <Animated.View style={[styles.pathFill, contentStyle]}>
            <LevelPath
              map={map}
              progress={progress}
              width={pathWidth}
              height={pathHeight}
              onSelect={onSelectLevel}
              interactive={stage === 'open'}
            />
          </Animated.View>
        ) : null}
      </View>

      {/* The table button runs edge to edge along the foot of the card: a
          glowing gold hero once the table is open, a progress bar until then. */}
      {!locked ? (
        <Animated.View style={[contentStyle, tableOpen && styles.tableGlow, tableOpen && pulseStyle]}>
          <PressableScale
            accessibilityLabel={
              tableOpen
                ? `Play blackjack at ${map.name}, max bet ${formatChips(map.maxBet)}`
                : `${map.name} table opens in ${remaining} level${remaining === 1 ? '' : 's'}, ${levelsDone} of ${FLASH_LEVELS_PER_MAP} done`
            }
            onPress={onTable}
            disabled={!playable}
            style={[styles.tableButton, !tableOpen && styles.tableButtonLocked]}
          >
            <Ionicons
              name={tableOpen ? 'play' : 'lock-closed'}
              size={tableOpen ? 22 : 16}
              color={tableOpen ? colors.textOnGold : colors.textMuted}
            />
            <View style={styles.tableButtonCopy}>
              <Text style={[styles.tableButtonText, !tableOpen && styles.tableButtonTextLocked]}>
                {tableOpen ? 'PLAY TABLE' : `Table opens in ${remaining} level${remaining === 1 ? '' : 's'}`}
              </Text>
              {tableOpen ? (
                <Text style={styles.tableButtonSub}>max bet {formatChips(map.maxBet)}</Text>
              ) : null}
            </View>
            {!tableOpen ? (
              <View style={styles.tableProgressTrack} pointerEvents="none">
                <View
                  style={[
                    styles.tableProgressFill,
                    { width: `${(levelsDone / FLASH_LEVELS_PER_MAP) * 100}%` },
                  ]}
                />
              </View>
            ) : null}
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm,
  },
  headerSpacer: {
    width: layout.touchTarget,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
  },
  headerButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.background,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    ...shadows.raised,
  },
  cardInactive: {
    opacity: 0.55,
  },
  /** Name + status line: painted above the lock pane so they stay readable. */
  banner: {
    gap: spacing.xs,
    zIndex: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  mapName: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  /** Casino art fills the card behind the ladder, dimmed to keep the chips legible. */
  art: {
    position: 'absolute',
    top: 0,
    opacity: 0.5,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.goldBright,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  modeButtonText: {
    color: colors.textOnGold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
  },
  modeButtonQuiz: {
    backgroundColor: colors.overlayLight,
  },
  modeButtonQuizText: {
    color: colors.goldBright,
  },
  pathWrap: {
    flex: 1,
    minHeight: 0,
  },
  pathFill: {
    flex: 1,
  },
  lockPane: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    zIndex: 2,
  },
  lockBody: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Closed and open locks stack in one slot so they can crossfade. */
  lockBadge: {
    width: 64,
    height: 64,
  },
  lockIcon: {
    width: 64,
    height: 64,
  },
  lockIconOver: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  lockText: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
  },
  tableGlow: {
    shadowColor: colors.goldBright,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  tableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 58,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.goldBright,
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: 'hidden',
  },
  tableButtonLocked: {
    minHeight: 44,
    backgroundColor: colors.overlayLight,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  tableButtonCopy: {
    alignItems: 'center',
  },
  tableButtonText: {
    color: colors.textOnGold,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.5,
  },
  tableButtonTextLocked: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    letterSpacing: 1,
  },
  tableButtonSub: {
    color: colors.textOnGold,
    opacity: 0.75,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  /** Thin fill along the foot of the locked bar: levels cleared so far. */
  tableProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: colors.overlayLight,
  },
  tableProgressFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  devRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  devLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.5,
  },
  devLink: {
    color: colors.warning,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSubtle,
  },
  dotActive: {
    backgroundColor: colors.textPrimary,
  },
});
