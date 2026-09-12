import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import { CARD_BACK, CardSkin } from '../../assets/cards.generated';
import { ArcadeBevel, ArcadeTab } from '../arcade';
import { PlayingCard, CARD_ASPECT, cardCornerRadius } from '../game/PlayingCard';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { QuizFlashStep } from '../../stores/quizSessionStore';
import { colors, fonts, fontSizes, fontWeights, radii, spacing } from '../../theme';

interface QuizFlashStageProps {
  readonly step: QuizFlashStep | null;
  readonly stepIndex: number;
  readonly totalSteps: number;
  /** Tier-driven aids: training faces early, Hi-Lo glow until streak 6. */
  readonly skin: CardSkin;
  readonly underglow: boolean;
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

/** The Modern flash keeps the mock's card sizes on the open felt. */
const ARCADE_PAIR_WIDTH = 104;
const ARCADE_SINGLE_WIDTH = 130;

/**
 * Cinematic flash area. Cards slide in from the deck with a small rotation,
 * face-down decoys carry a "DECOY — IGNORE" banner, and pairs fan slightly.
 */
export function QuizFlashStage({
  step,
  stepIndex,
  totalSteps,
  skin,
  underglow,
}: QuizFlashStageProps) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const modern = useModernUi();

  const entering = reducedMotion ? undefined : FLASH_ENTERING;

  if (!step) {
    return null;
  }

  const pair = step.length > 1;
  const flashCardWidth = modern
    ? pair
      ? ARCADE_PAIR_WIDTH
      : ARCADE_SINGLE_WIDTH
    : pair
      ? Math.min(width * 0.3, 120)
      : Math.min(width * 0.38, 150);
  const decoy = step.some((item) => item.faceDown);

  if (modern) {
    return (
      <View style={styles.arcadeStage}>
        <View style={styles.cardRow}>
          {step.map((item, index) => {
            const offset = pair ? (index === 0 ? -8 : 8) : 0;
            const rotate = pair ? (index === 0 ? '-4deg' : '4deg') : '0deg';
            return (
              <Animated.View key={item.card.id} entering={entering}>
                <View style={{ transform: [{ translateX: offset }, { rotate: rotate }] }}>
                  {item.faceDown ? (
                    <View>
                      <Image
                        source={CARD_BACK}
                        style={{
                          width: flashCardWidth,
                          height: flashCardWidth / CARD_ASPECT,
                          borderRadius: cardCornerRadius(flashCardWidth),
                        }}
                        accessibilityLabel="Face-down card — does not count"
                      />
                      <ArcadeBevel
                        face={colors.arcadeRed}
                        deep={colors.arcadeRedDeep}
                        drop={3}
                        outline={2}
                        band={0}
                        radius={6}
                        style={styles.arcadeDecoy}
                        faceStyle={styles.arcadeDecoyFace}
                      >
                        <Text style={styles.arcadeDecoyText}>DECOY</Text>
                      </ArcadeBevel>
                    </View>
                  ) : (
                    <PlayingCard
                      card={item.card}
                      skin={skin}
                      width={flashCardWidth}
                      underglow={underglow}
                    />
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>
        <ArcadeTab label={`Flash ${stepIndex + 1} of ${totalSteps}`} />
        {decoy ? <Text style={styles.arcadeDecoyHint}>Ignore face-down cards</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <View style={styles.cardRow}>
        {step.map((item, index) => {
          const offset = pair ? (index === 0 ? -8 : 8) : 0;
          const rotate = pair ? (index === 0 ? '-4deg' : '4deg') : '0deg';
          // The entering keyframe animates transform, so the pair fan lives on
          // an inner view — otherwise Reanimated warns it may overwrite it.
          return (
            <Animated.View key={item.card.id} entering={entering}>
              <View
                style={{
                  transform: [{ translateX: offset }, { rotate: rotate }],
                }}
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
                    skin={skin}
                    width={flashCardWidth}
                    underglow={underglow}
                  />
                )}
              </View>
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
  arcadeStage: {
    alignItems: 'center',
    gap: spacing.md,
  },
  arcadeDecoy: {
    position: 'absolute',
    left: spacing.xs,
    right: spacing.xs,
    bottom: 10,
  },
  arcadeDecoyFace: {
    alignItems: 'center',
  },
  arcadeDecoyText: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 18,
    letterSpacing: 2,
    color: colors.arcadeCream,
    includeFontPadding: false,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  arcadeDecoyHint: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.5,
    color: colors.arcadeLoss,
    textAlign: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
