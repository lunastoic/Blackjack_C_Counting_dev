import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { appAssets, MAP_ART } from '../../assets/registry';
import { CASINO_MAPS, CasinoMap } from '../../engine/betting/casino';
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
const MAX_VISIBLE = 2;
const SIDE_DIM = 0.28;
const MOVE_MS = 450;
const SWIPE_THRESHOLD = 48;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export type QuizOrGameMode = GameMode | 'quiz';

interface MapCoverflowProps {
  readonly visible: boolean;
  readonly currentMapId: number;
  readonly onClose: () => void;
  /** Fired when the player picks a mode on an unlocked map. */
  readonly onSelect: (mapId: number, mode: QuizOrGameMode) => void;
}

/** One card in the 3D fan. All motion runs through Reanimated transforms. */
function CoverflowCard({
  map,
  rel,
  cardWidth,
  cardHeight,
  unlocked,
  canUnlock,
  onPress,
}: {
  map: CasinoMap;
  rel: number;
  cardWidth: number;
  cardHeight: number;
  unlocked: boolean;
  canUnlock: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const shake = useSharedValue(0);
  const isCenter = rel === 0;
  const ax = Math.abs(rel);
  const visible = ax <= MAX_VISIBLE;

  const animatedStyle = useAnimatedStyle(() => {
    const targetX = rel * cardWidth * 0.52;
    const targetScale = Math.max(0.4, 1 - ax * SCALE_STEP);
    const targetRotY = -rel * TILT_DEG;
    const targetRotZ = rel * SIDE_TILT_DEG;
    const targetOpacity = visible ? 1 : 0;
    const timing = { duration: reducedMotion ? 0 : MOVE_MS, easing: EASE };
    return {
      transform: [
        { perspective: 1200 },
        { translateX: withTiming(targetX, timing) },
        { rotateY: withTiming(`${targetRotY}deg`, timing) },
        { rotateZ: withTiming(`${targetRotZ}deg`, timing) },
        { scale: withTiming(targetScale, timing) },
      ],
      opacity: withTiming(targetOpacity, timing),
    };
  }, [rel, ax, visible, cardWidth, reducedMotion]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const dimStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(isCenter ? 0 : SIDE_DIM, {
        duration: reducedMotion ? 0 : MOVE_MS,
        easing: EASE,
      }),
    }),
    [isCenter, reducedMotion],
  );

  function handlePress() {
    if (!isCenter) {
      onPress();
      return;
    }
    if (!unlocked && !canUnlock) {
      void haptics.warning();
      if (!reducedMotion) {
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
                : `${map.name}, locked until level ${map.unlockLevel}`
          }
        >
          <Image source={MAP_ART[map.artKey]} style={styles.cardArt} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.cardGradient}
            pointerEvents="none"
          />
          <View style={styles.cardTitleBlock} pointerEvents="none">
            <Text style={styles.cardTitle} numberOfLines={2}>
              {map.name}
            </Text>
            <Text style={styles.cardSubtitle}>Max bet {formatChips(map.maxBet)}</Text>
          </View>
          {!unlocked ? (
            <View
              style={[styles.lockOverlay, isCenter ? styles.lockOverlayCenter : styles.lockOverlaySide]}
              pointerEvents="none"
            >
              <Image
                source={canUnlock ? appAssets.icons.unlock : appAssets.icons.lock}
                style={styles.lockIcon}
                resizeMode="contain"
              />
              <Text style={styles.lockText}>
                {canUnlock ? 'Tap to unlock' : `Level ${map.unlockLevel}`}
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
  const unlockMap = useProgressionStore((state) => state.unlockMap);

  const startIndex = Math.max(
    0,
    CASINO_MAPS.findIndex((m) => m.id === currentMapId),
  );
  const [active, setActive] = useState(startIndex);

  useEffect(() => {
    if (visible) {
      setActive(startIndex);
    }
  }, [visible, startIndex]);

  const n = CASINO_MAPS.length;
  const cardWidth = Math.min(width * 0.58, 250);
  const cardHeight = cardWidth * 1.25;

  const activeMap = CASINO_MAPS[active];
  const activeUnlocked = isMapUnlocked(activeMap.id);
  const activeCanUnlock = !activeUnlocked && level >= activeMap.unlockLevel;

  const goNext = useCallback(() => {
    setActive((current) => (current + 1) % n);
  }, [n]);

  const goPrev = useCallback(() => {
    setActive((current) => (current - 1 + n) % n);
  }, [n]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onEnd((event) => {
      if (event.translationX <= -SWIPE_THRESHOLD || event.velocityX <= -450) {
        runOnJS(goNext)();
      } else if (event.translationX >= SWIPE_THRESHOLD || event.velocityX >= 450) {
        runOnJS(goPrev)();
      }
    });

  const handleCardPress = useCallback(
    (index: number) => {
      if (index !== active) {
        setActive(index);
        return;
      }
      const map = CASINO_MAPS[index];
      if (!isMapUnlocked(map.id) && level >= map.unlockLevel && unlockMap(map.id)) {
        playSound('achievementUnlock');
        void haptics.success();
      }
    },
    [active, isMapUnlocked, level, unlockMap],
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
                let rel = i - active;
                if (rel > n / 2) rel -= n;
                if (rel < -n / 2) rel += n;
                return (
                  <CoverflowCard
                    key={map.id}
                    map={map}
                    rel={rel}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    unlocked={isMapUnlocked(map.id)}
                    canUnlock={!isMapUnlocked(map.id) && level >= map.unlockLevel}
                    onPress={() => handleCardPress(i)}
                  />
                );
              })}
            </View>
          </GestureDetector>

          <View style={styles.dots}>
            {CASINO_MAPS.map((map, i) => (
              <Pressable
                key={map.id}
                onPress={() => setActive(i)}
                accessibilityLabel={`Show ${map.name}`}
                style={[styles.dot, i === active && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.modePanel}>
            {activeUnlocked ? (
              <View style={styles.modeRow}>
                <PressableScale
                  style={styles.modeButton}
                  accessibilityLabel={`Play blackjack at ${activeMap.name}`}
                  onPress={() => onSelect(activeMap.id, 'regular')}
                >
                  <Text style={styles.modeButtonText}>Play</Text>
                  <Text style={styles.modeButtonHint}>blackjack + count coach</Text>
                </PressableScale>
                <PressableScale
                  style={styles.modeButton}
                  accessibilityLabel={`Play ${activeMap.name} in Quiz Mode`}
                  onPress={() => onSelect(activeMap.id, 'quiz')}
                >
                  <Text style={styles.modeButtonText}>Quiz</Text>
                  <Text style={styles.modeButtonHint}>speed count sprints</Text>
                </PressableScale>
              </View>
            ) : (
              <Text style={styles.lockedHint}>
                {activeCanUnlock
                  ? 'Tap the card to unlock this casino.'
                  : `Reach level ${activeMap.unlockLevel} to unlock ${activeMap.name}. You are level ${level}.`}
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
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
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
    borderWidth: 1,
    borderColor: colors.borderGold,
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
    height: '55%',
  },
  cardTitleBlock: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: 2,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
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
  modePanel: {
    minHeight: 76,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    maxWidth: 160,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modeButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  modeButtonHint: {
    color: colors.textMuted,
    fontSize: 10,
  },
  lockedHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
  },
});
