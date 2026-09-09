import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { appAssets, MAP_ART } from '../../assets/registry';
import { FEATURES } from '../../constants/features';
import { CASINO_MAPS, CasinoMap, mapById, permitMaxBet, TableLicense } from '../../engine/betting/casino';
import { GameMode } from '../../engine/blackjack/rules';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useProgressionStore } from '../../stores/progressionStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { PressableScale } from '../common/PressableScale';

/** Coverflow geometry (ported from the Framer original, tuned for phones). */
const TILT_DEG = 24;
const SIDE_TILT_DEG = 4;
const SCALE_STEP = 0.16;
/** Horizontal spacing between neighbouring cards, as a fraction of card width. */
const STEP_FRACTION = 0.52;
const MAX_VISIBLE = 2;
const SIDE_DIM = 0.28;
const MOVE_MS = 450;
/** Shortest snap, so a nudge back to centre never feels sticky. */
const MIN_MOVE_MS = 160;
const FLING_VELOCITY = 450;
/** How far the fan can be dragged past either end before it springs back. */
const OVERSCROLL = 0.35;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** Within range, identity; past either end the value eases toward `OVERSCROLL`. */
function rubberBand(value: number, min: number, max: number): number {
  'worklet';
  if (value < min) {
    const over = min - value;
    return min - OVERSCROLL * (over / (over + 1));
  }
  if (value > max) {
    const over = value - max;
    return max + OVERSCROLL * (over / (over + 1));
  }
  return value;
}

/** Snap time scales with distance in cards, capped at a full step's `MOVE_MS`. */
function snapDuration(distance: number, reducedMotion: boolean): number {
  'worklet';
  if (reducedMotion) {
    return 0;
  }
  return clamp(Math.abs(distance) * MOVE_MS, MIN_MOVE_MS, MOVE_MS);
}

export type QuizOrGameMode = GameMode | 'quiz';

interface MapCoverflowProps {
  readonly visible: boolean;
  readonly currentMapId: number;
  readonly onClose: () => void;
  /** Fired when the player picks a mode on an unlocked map. */
  readonly onSelect: (mapId: number, mode: QuizOrGameMode) => void;
}

/** Short hint under the Play button for each table licence. */
function playHint(map: CasinoMap, license: TableLicense): string {
  switch (license) {
    case 'none':
      return 'Clear 6 levels';
    case 'permit':
      return `Permit · max ${formatChips(permitMaxBet(map))}`;
    case 'licensed':
      return 'Chips & aids';
  }
}

/**
 * One card in the 3D fan — poster art, the casino's name, and (on the centred,
 * unlocked card) the Play / Quiz buttons. Every transform is a pure function of
 * the fan's continuous `position`, evaluated on the UI thread, so the cards
 * track the finger and glide through each other without a seam.
 */
function CoverflowCard({
  map,
  index,
  position,
  active,
  cardWidth,
  cardHeight,
  unlocked,
  canUnlock,
  lockedLabel,
  license,
  onPress,
  onPlay,
  onQuiz,
}: {
  map: CasinoMap;
  index: number;
  /** Fractional index of the card currently centred — see `MapCoverflow`. */
  position: SharedValue<number>;
  /** Nearest whole card to `position`; flips at the midpoint between two cards. */
  active: number;
  cardWidth: number;
  cardHeight: number;
  unlocked: boolean;
  canUnlock: boolean;
  /** Short text on the lock overlay while the card cannot be unlocked yet. */
  lockedLabel: string;
  license: TableLicense;
  onPress: () => void;
  onPlay: () => void;
  onQuiz: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const shake = useSharedValue(0);
  // Stacking and hit-testing follow the nearest card. At the midpoint the two
  // cards swapping places are mirror images, so the z-order flip is invisible.
  const isCenter = index === active;
  const ax = Math.abs(index - active);
  const visible = ax <= MAX_VISIBLE;
  const tableLocked = license === 'none';

  const animatedStyle = useAnimatedStyle(() => {
    const rel = index - position.value;
    const distance = Math.abs(rel);
    return {
      transform: [
        { perspective: 1200 },
        { translateX: rel * cardWidth * STEP_FRACTION },
        { rotateY: `${-rel * TILT_DEG}deg` },
        { rotateZ: `${rel * SIDE_TILT_DEG}deg` },
        { scale: Math.max(0.4, 1 - distance * SCALE_STEP) },
      ],
      // Cards beyond the visible fan fade out over their last step.
      opacity: 1 - clamp(distance - MAX_VISIBLE, 0, 1),
    };
  }, [index, cardWidth]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const dimStyle = useAnimatedStyle(() => {
    const distance = Math.abs(index - position.value);
    return { opacity: clamp(distance, 0, 1) * SIDE_DIM };
  }, [index]);

  // The mode buttons ride the poster and fade in as the card settles centre.
  const modeRowStyle = useAnimatedStyle(() => {
    const distance = Math.abs(index - position.value);
    return { opacity: 1 - clamp(distance * 1.5, 0, 1) };
  }, [index]);

  function handlePress() {
    if (!isCenter) {
      onPress();
      return;
    }
    if (!unlocked && !canUnlock) {
      void haptics.warning();
      if (!reducedMotion) {
        // Shared values are mutable by design in Reanimated.
        // eslint-disable-next-line react-hooks/immutability
        shake.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(-5, { duration: 50 }),
          withTiming(5, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
      }
      return;
    }
    onPress();
  }

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width: cardWidth,
          height: cardHeight,
          marginLeft: -cardWidth / 2,
          marginTop: -cardHeight / 2,
          zIndex: 10 - ax,
        },
        animatedStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.cardShakeWrap, shakeStyle]}>
        <Pressable
          style={styles.cardInner}
          onPress={handlePress}
          accessibilityLabel={
            unlocked
              ? `${map.name}, tap to choose`
              : canUnlock
                ? `${map.name}, tap to unlock`
                : `${map.name}, locked — ${lockedLabel}`
          }
        >
          <Image source={MAP_ART[map.artKey]} style={styles.cardArt} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.94)']}
            locations={[0, 0.45, 1]}
            style={styles.cardGradient}
            pointerEvents="none"
          />
          <View style={styles.cardFooter} pointerEvents="box-none">
            <View style={styles.cardTitleBlock} pointerEvents="none">
              <Text style={styles.cardTitle} numberOfLines={2}>
                {map.name}
              </Text>
              <Text style={styles.cardSubtitle}>Max bet {formatChips(map.maxBet)}</Text>
            </View>
            {unlocked ? (
              <Animated.View
                style={[styles.modeRow, modeRowStyle]}
                pointerEvents={isCenter ? 'auto' : 'none'}
              >
                <PressableScale
                  style={[styles.modeButton, styles.modeButtonPlay, tableLocked && styles.modeButtonLocked]}
                  accessibilityLabel={
                    tableLocked
                      ? `${map.name} table locked — clear its six levels first`
                      : `Play blackjack at ${map.name}`
                  }
                  onPress={() => {
                    if (tableLocked) {
                      void haptics.warning();
                      return;
                    }
                    onPlay();
                  }}
                >
                  <Text style={[styles.modeButtonText, tableLocked && styles.modeButtonTextLocked]}>
                    {tableLocked ? 'PLAY 🔒' : 'PLAY'}
                  </Text>
                  <Text style={styles.modeButtonHint} numberOfLines={1}>
                    {playHint(map, license)}
                  </Text>
                </PressableScale>
                <PressableScale
                  style={[styles.modeButton, tableLocked && styles.modeButtonFeatured]}
                  accessibilityLabel={`Play ${map.name} in Quiz Mode`}
                  onPress={onQuiz}
                >
                  <Text style={styles.modeButtonText}>QUIZ</Text>
                  <Text style={styles.modeButtonHint} numberOfLines={1}>
                    Beat your best
                  </Text>
                </PressableScale>
              </Animated.View>
            ) : null}
          </View>
          {!unlocked ? (
            <View
              style={[styles.lockOverlay, isCenter ? styles.lockOverlayCenter : styles.lockOverlaySide]}
              pointerEvents="none"
            >
              <Image
                source={canUnlock ? appAssets.icons.unlock : appAssets.icons.lock}
                style={styles.lockIcon}
                contentFit="contain"
              />
              <Text style={styles.lockText}>
                {canUnlock ? 'Tap to unlock' : lockedLabel}
              </Text>
            </View>
          ) : null}
          <Animated.View style={[styles.dimVeil, dimStyle]} pointerEvents="none" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The globe overlay: a 3D coverflow of all six casinos floating over the live
 * table with a dimmed backdrop. Swipe or tap a side card to centre it;
 * the centre card offers Play / Quiz (or unlocking).
 */
export function MapCoverflow({ visible, currentMapId, onClose, onSelect }: MapCoverflowProps) {
  const { width } = useWindowDimensions();
  const level = useProgressionStore((state) => state.level);
  const isMapUnlocked = useProgressionStore((state) => state.isMapUnlocked);
  const canUnlockMap = useProgressionStore((state) => state.canUnlockMap);
  const unlockMap = useProgressionStore((state) => state.unlockMap);
  const licenseForMap = useProgressionStore((state) => state.licenseForMap);

  /** Lock-overlay text for a casino that cannot be unlocked yet. */
  function lockedLabelFor(map: CasinoMap): string {
    if (FEATURES.levelMapGating) {
      return `Level ${map.unlockLevel}`;
    }
    const previous = mapById(map.id - 1);
    return previous ? `Clear ${previous.name}` : 'Locked';
  }

  const startIndex = Math.max(
    0,
    CASINO_MAPS.findIndex((m) => m.id === currentMapId),
  );
  const n = CASINO_MAPS.length;
  const reducedMotion = useReducedMotion();

  // The fan's state is one continuous number: the (fractional) index of the
  // card at centre. Dragging moves it with the finger, letting go snaps it to a
  // whole card, and every card draws itself from it on the UI thread. `active`
  // mirrors the nearest whole card for the JS-side bits (z-order, dots, hints).
  const position = useSharedValue(startIndex);
  const dragStart = useSharedValue(startIndex);
  const [active, setActive] = useState(startIndex);

  useEffect(() => {
    if (!visible) {
      // Park the fan on the current casino while closed, so it opens there.
      // The reaction below brings `active` along.
      cancelAnimation(position);
      position.set(startIndex);
    }
  }, [visible, startIndex, position]);

  const tick = useCallback(() => {
    void haptics.selection();
  }, []);

  useAnimatedReaction(
    () => Math.round(clamp(position.get(), 0, n - 1)),
    (nearest, previous) => {
      // Compare against React's copy, not just the last frame: the first run
      // after a re-register may already be past a jump (the closed reset).
      if (nearest !== active) {
        runOnJS(setActive)(nearest);
      }
      if (visible && previous !== null && nearest !== previous) {
        runOnJS(tick)();
      }
    },
    [n, visible, active, tick],
  );

  // Movie-poster proportions: tall enough to carry the title and mode buttons.
  const cardWidth = Math.min(width * 0.62, 260);
  const cardHeight = cardWidth * 1.52;
  const step = cardWidth * STEP_FRACTION;

  const activeMap = CASINO_MAPS[active];
  const activeUnlocked = isMapUnlocked(activeMap.id);
  const activeCanUnlock = canUnlockMap(activeMap.id);
  const activeLicense = licenseForMap(activeMap.id);

  /** Glide the fan to a whole card; short hops take proportionally less time. */
  const moveTo = useCallback(
    (index: number) => {
      const target = clamp(index, 0, n - 1);
      cancelAnimation(position);
      position.set(
        withTiming(target, {
          duration: snapDuration(target - position.get(), reducedMotion),
          easing: EASE,
        }),
      );
    },
    [n, position, reducedMotion],
  );

  // The fan is a straight line, not a wheel: Luna Luxe sits at the left end
  // with nothing before it, Kepler at the right end with nothing after — drag
  // past either end and it only gives a little before springing back.
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onStart(() => {
      cancelAnimation(position);
      dragStart.set(position.get());
    })
    .onUpdate((event) => {
      position.set(rubberBand(dragStart.get() - event.translationX / step, 0, n - 1));
    })
    .onEnd((event) => {
      const current = position.get();
      // A fling carries on to the next card in its direction; a slow release
      // settles on whichever card is nearest.
      const target = clamp(
        event.velocityX <= -FLING_VELOCITY
          ? Math.floor(current) + 1
          : event.velocityX >= FLING_VELOCITY
            ? Math.ceil(current) - 1
            : Math.round(current),
        0,
        n - 1,
      );
      position.set(
        withTiming(target, {
          duration: snapDuration(target - current, reducedMotion),
          easing: EASE,
        }),
      );
    });

  const handleCardPress = useCallback(
    (index: number) => {
      if (index !== active) {
        moveTo(index);
        return;
      }
      if (unlockMap(CASINO_MAPS[index].id)) {
        playSound('achievementUnlock');
        void haptics.success();
      }
    },
    [active, moveTo, unlockMap],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.shell}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close map picker" />

        <View style={styles.content} pointerEvents="box-none">
          <Text style={styles.heading}>Casinos</Text>

          <GestureDetector gesture={pan}>
            <View style={[styles.stage, { height: cardHeight + spacing.lg }]} pointerEvents="box-none">
              {CASINO_MAPS.map((map, i) => {
                return (
                  <CoverflowCard
                    key={map.id}
                    map={map}
                    index={i}
                    position={position}
                    active={active}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    unlocked={isMapUnlocked(map.id)}
                    canUnlock={canUnlockMap(map.id)}
                    lockedLabel={lockedLabelFor(map)}
                    license={licenseForMap(map.id)}
                    onPress={() => handleCardPress(i)}
                    onPlay={() => onSelect(map.id, 'regular')}
                    onQuiz={() => onSelect(map.id, 'quiz')}
                  />
                );
              })}
            </View>
          </GestureDetector>

          <View style={styles.dots}>
            {CASINO_MAPS.map((map, i) => (
              <Pressable
                key={map.id}
                onPress={() => moveTo(i)}
                accessibilityLabel={`Show ${map.name}`}
                style={[styles.dot, i === active && styles.dotActive]}
              />
            ))}
          </View>

          {/* Play / Quiz live on the poster; only the fine print sits below it. */}
          <View style={styles.hintPanel}>
            {activeUnlocked ? (
              activeLicense !== 'licensed' ? (
                <Text style={styles.licenseHint}>
                  {activeLicense === 'none'
                    ? 'Clear the six training levels to open this table.'
                    : 'Hit 9 in a row in the Count Sprint to lift the bet cap.'}
                </Text>
              ) : null
            ) : (
              <Text style={styles.lockedHint}>
                {activeCanUnlock
                  ? 'Tap the card to unlock this casino.'
                  : FEATURES.levelMapGating
                    ? `Reach level ${activeMap.unlockLevel} to unlock ${activeMap.name}. You are level ${level}.`
                    : `Clear all six levels at ${mapById(activeMap.id - 1)?.name ?? 'the previous casino'} to open ${activeMap.name}.`}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Near-black scrim: the live table reads as a faint backdrop, not a distraction.
    backgroundColor: 'rgba(0, 0, 0, 0.86)',
    zIndex: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    zIndex: 1,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
    letterSpacing: 1,
  },
  stage: {
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  cardShakeWrap: {
    flex: 1,
  },
  cardInner: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  cardArt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: undefined,
    height: undefined,
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  cardFooter: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitleBlock: {
    gap: 2,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  cardSubtitle: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  lockOverlayCenter: {
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  lockOverlaySide: {
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  lockIcon: {
    width: 48,
    height: 48,
  },
  lockText: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  dimVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    opacity: 0.4,
  },
  dotActive: {
    backgroundColor: colors.goldBright,
    opacity: 1,
  },
  hintPanel: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  // Sits on the poster's dark gradient, under a gold hairline.
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderGold,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modeButtonPlay: {
    backgroundColor: colors.burgundy,
    borderColor: colors.gold,
  },
  modeButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.5,
  },
  modeButtonHint: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  modeButtonLocked: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderColor: colors.borderSubtle,
    opacity: 0.7,
  },
  modeButtonTextLocked: {
    color: colors.textMuted,
  },
  modeButtonFeatured: {
    backgroundColor: colors.burgundy,
    borderColor: colors.goldBright,
    borderWidth: 1.5,
  },
  licenseHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  lockedHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
  },
});
