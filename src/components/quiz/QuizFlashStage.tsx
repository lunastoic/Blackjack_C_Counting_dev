import React from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CARD_BACK } from '../../assets/cards.generated';
import { PlayingCard, CARD_ASPECT } from '../game/PlayingCard';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { QuizFlashStep } from '../../stores/quizSessionStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

interface QuizFlashStageProps {
  readonly step: QuizFlashStep | null;
  readonly stepIndex: number;
  readonly totalSteps: number;
}

const FLASH_ENTERING = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateX: 90 }, { translateY: -60 }, { rotate: '10deg' }, { scale: 0.85 }],
  },
  100: {
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }],
  },
}).duration(220);

/**
 * Cinematic flash area. Cards slide in from the deck with a small rotation,
 * face-down decoys carry a "DECOY — IGNORE" banner, and pairs fan slightly.
 */
export function QuizFlashStage({ step, stepIndex, totalSteps }: QuizFlashStageProps) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (reducedMotion) {
      pulse.value = 1;
      return;
    }
    // No completion callback here: withRepeat callbacks crash Fabric in this
    // Expo Go / Reanimated pairing, and reverse:true already ends at 1.
    pulse.value = withRepeat(withTiming(1.08, { duration: 300 }), 2, true);
  }, [stepIndex, reducedMotion, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.12 + pulse.value * 0.08,
  }));

  const entering = reducedMotion ? undefined : FLASH_ENTERING;

  if (!step) {
    return null;
  }

  const pair = step.length > 1;
  const flashCardWidth = pair ? Math.min(width * 0.3, 120) : Math.min(width * 0.38, 150);
  const decoy = step.some((item) => item.faceDown);

  return (
    <View style={styles.stage}>
      <Animated.View pointerEvents="none" style={[styles.focusRing, ringStyle]} />
      <View style={styles.cardRow}>
        {step.map((item, index) => {
          const offset = pair ? (index === 0 ? -8 : 8) : 0;
          const rotate = pair ? (index === 0 ? '-4deg' : '4deg') : '0deg';
          return (
            <Animated.View
              key={item.card.id}
              entering={entering}
              style={[{ transform: [{ translateX: offset }, { rotate: rotate }] }]}
            >
              {item.faceDown ? (
                <View>
                  <Image
                    source={CARD_BACK}
                    style={{
                      width: flashCardWidth,
                      height: flashCardWidth / CARD_ASPECT,
                      borderRadius: radii.sm,
                    }}
                    accessibilityLabel="Face-down card — does not count"
                  />
                  <View style={styles.decoyBanner}>
                    <Text style={styles.decoyText}>DECOY</Text>
                  </View>
                </View>
              ) : (
                <PlayingCard
                  card={item.card}
                  skin="regular"
                  width={flashCardWidth}
                  underglow={false}
                />
              )}
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.progressText}>
          Flash {stepIndex + 1} of {totalSteps}
        </Text>
        {decoy ? <Text style={styles.decoyHint}>Ignore face-down cards</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  focusRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.gold,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  decoyBanner: {
    position: 'absolute',
    bottom: 10,
    left: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: radii.xs,
    paddingVertical: 2,
    alignItems: 'center',
  },
  decoyText: {
    color: colors.textPrimary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  metaRow: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: 2,
    zIndex: 1,
  },
  progressText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
  decoyHint: {
    color: colors.error,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
  },
});
