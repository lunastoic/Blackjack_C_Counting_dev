import { Image } from 'expo-image';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CARD_BACK, CARD_FACES } from '../../assets/cards.generated';
import { hiLoValue, Rank, RANKS, Suit, SUITS } from '../../engine/cards/card';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { CARD_ASPECT } from '../game/PlayingCard';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { PrimaryButton } from '../common/PrimaryButton';
import { FlashPanel } from './FlashPanel';

/**
 * Five-beat Hi-Lo primer, dealt from a real deck. While the table idles, all
 * 52 cards lie fanned in a ribbon across the felt. Begin sweeps them into one
 * pile at the dealer spot; each beat then pulls its cards out of the pile,
 * lets them breathe their glow, and slides them back before the next group
 * comes out.
 */
export const TUTORIAL_STEPS = 5;

/** One half-breathe of the card glow. Calm, not a strobe. */
const PULSE_HALF_MS = 750;
const SPREAD_CARD_WIDTH = 34;
const COLLECT_MS = 420;
const PULL_MS = 420;
/** Beat cards wait for the pile to gather before they slide out. */
const PULL_START_DELAY_MS = 350;

/**
 * Deck geometry, top-down in points so the deck is the same size on any felt:
 * the pile sits just under the dealer's rail, the fan an open strip of felt
 * below it, and the count flag hangs under the fan on the betting beats.
 */
const PILE_TOP = spacing.md;
const FAN_GAP = 28;
/** Flag height plus its margins. */
const FLAG_ROOM = spacing.md + 32 + spacing.sm;
/** The ribbon's end cards lean this far. */
const RIBBON_TILT_DEG = 26;
/** The ribbon's ends rise this far above its middle card. */
const RIBBON_RISE = 34;

/** Half the height of a `width`×`height` card leaning `degrees`. */
function leaningHalfHeight(width: number, height: number, degrees: number): number {
  const angle = (degrees * Math.PI) / 180;
  return (height / 2) * Math.cos(angle) + (width / 2) * Math.sin(angle);
}

/** Centre line of the ribbon's middle card: the leaning ends just clear the rail. */
const RIBBON_MID_Y =
  PILE_TOP +
  leaningHalfHeight(SPREAD_CARD_WIDTH, SPREAD_CARD_WIDTH / CARD_ASPECT, RIBBON_TILT_DEG) +
  RIBBON_RISE;
/** Foot of the ribbon spread — the middle card's bottom edge; lettering prints below it. */
export const SPREAD_DECK_BOTTOM = Math.ceil(RIBBON_MID_Y + SPREAD_CARD_WIDTH / CARD_ASPECT / 2);

/** Pile and pulled cards read at one size: five across with room to spare. */
function beatCardWidth(width: number): number {
  return Math.min((width - 72) / 5 - 4, 66);
}

/** Foot of the gathered pile; lettering prints below it while the deck rests. */
export function pileBottom(width: number): number {
  return Math.ceil(PILE_TOP + beatCardWidth(width) / CARD_ASPECT);
}

/** Felt the pile-and-fan deck wants: pile, gap, fan, flag. */
export function tutorialStageHeight(width: number): number {
  const cardHeight = beatCardWidth(width) / CARD_ASPECT;
  return Math.round(PILE_TOP + cardHeight + FAN_GAP + cardHeight + FLAG_ROOM);
}

interface TutorialBeat {
  readonly ranks: readonly Rank[];
  readonly title: string;
  readonly body: string;
  readonly color: string;
  /** Big count flag shown above the fan ("+7" / "−7"). */
  readonly badge?: string;
}

const BEATS: readonly TutorialBeat[] = [
  {
    ranks: ['10', 'J', 'Q', 'K', 'A'],
    title: 'These count −1',
    body: 'Tens, faces and aces. Red glow.',
    color: colors.trainingMinus,
  },
  {
    ranks: ['7', '8', '9'],
    title: 'These count 0',
    body: 'Skip them.',
    color: colors.trainingNeutral,
  },
  {
    ranks: ['2', '3', '4', '5', '6'],
    title: 'These count +1',
    body: 'Low cards. Green glow.',
    color: colors.trainingPlus,
  },
  {
    // The low cards you counted out — they drove the count up to +7.
    ranks: ['2', '3', '4', '5', '6'],
    title: 'High count — bet big',
    body: 'Counting these out pushed you to +7 — the small cards are gone and the deck is loaded with tens and aces. Blackjacks are coming, and they pay YOU. Raise your bets.',
    color: colors.success,
    badge: '+7',
  },
  {
    // The high cards already dealt — they dragged the count down to −7.
    ranks: ['A', 'K', 'Q', 'J', '10'],
    title: 'Low count — bet small',
    body: 'These already hit the felt and dragged you to −7 — only small cards are left. The dealer stops busting and the edge is the house’s. Bet the minimum and wait it out.',
    color: colors.error,
    badge: '−7',
  },
];

const SUIT_CYCLE: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export function tutorialBeat(step: number): TutorialBeat {
  return BEATS[Math.min(Math.max(step, 0), BEATS.length - 1)];
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface FlashTutorialDeckProps {
  /** null = the 52-card ribbon spread; 0–4 = that beat's cards out of the pile. */
  readonly beat: number | null;
  /** With no beat out, keep the deck gathered in its pile instead of spreading it. */
  readonly gathered?: boolean;
  readonly width: number;
}

/** The felt during idle and the tutorial: ribbon spread, pile, pulled beats. */
export function FlashTutorialDeck({ beat, gathered = false, width }: FlashTutorialDeckProps) {
  // The gathered deck reads at the same size as the cards pulled from it.
  const pileCardWidth = beatCardWidth(width);
  const pile: Point = { x: width / 2, y: PILE_TOP + pileCardWidth / CARD_ASPECT / 2 };
  const spread = beat === null && !gathered;

  return (
    <View style={styles.area}>
      {spread ? null : <DeckPile pile={pile} cardWidth={pileCardWidth} />}
      {spread ? <RibbonSpread width={width} pile={pile} /> : null}
      {beat !== null ? <BeatCards key={beat} beat={beat} width={width} pile={pile} /> : null}
    </View>
  );
}

/** All 52 cards face up in a gentle ribbon, fanned out of / collected into the pile. */
function RibbonSpread({ width, pile }: { width: number; pile: Point }) {
  const reducedMotion = useReducedMotion();
  const cards = useMemo(
    () => SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))),
    [],
  );
  const cardHeight = SPREAD_CARD_WIDTH / CARD_ASPECT;

  return (
    <>
      {cards.map(({ suit, rank }, index) => {
        const t = (index / (cards.length - 1)) * 2 - 1; // −1 … 1 across the ribbon
        const x = width / 2 + t * width * 0.42;
        // Dealer-side ribbon: concave toward the dealer, matching the felt lettering.
        const y = RIBBON_MID_Y - t * t * RIBBON_RISE;
        const rotate = `${-t * RIBBON_TILT_DEG}deg`;
        // The fly-in un-tilts the card so it sits square on the pile; the
        // resting tilt lives on the inner view so the keyframe never fights it.
        const counterRotate = `${t * RIBBON_TILT_DEG}deg`;
        const dx = pile.x - x;
        const dy = pile.y - y;

        const entering = reducedMotion
          ? undefined
          : new Keyframe({
              0: { transform: [{ translateX: dx }, { translateY: dy }, { rotate: counterRotate }] },
              100: { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }] },
            })
              .duration(COLLECT_MS)
              .delay(index * 7);
        const exiting = reducedMotion
          ? undefined
          : new Keyframe({
              0: { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }] },
              100: { transform: [{ translateX: dx }, { translateY: dy }, { rotate: counterRotate }] },
            })
              .duration(COLLECT_MS)
              .delay(index * 6);

        return (
          <Animated.View
            key={`${suit}-${rank}`}
            entering={entering}
            exiting={exiting}
            style={[
              styles.spreadSlot,
              {
                left: x - SPREAD_CARD_WIDTH / 2,
                top: y - cardHeight / 2,
                width: SPREAD_CARD_WIDTH,
                height: cardHeight,
              },
            ]}
          >
            <View style={[styles.spreadCard, { transform: [{ rotate }] }]}>
              <Image source={CARD_FACES.regular[suit][rank]} style={styles.cardImage} contentFit="cover" />
            </View>
          </Animated.View>
        );
      })}
    </>
  );
}

/** The gathered deck at the dealer spot — three offset backs reading as a pile. */
function DeckPile({ pile, cardWidth }: { pile: Point; cardWidth: number }) {
  const reducedMotion = useReducedMotion();
  const cardHeight = cardWidth / CARD_ASPECT;
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(200)}
      style={[
        styles.pile,
        { left: pile.x - cardWidth / 2, top: pile.y - cardHeight / 2 },
      ]}
      accessibilityLabel="The deck"
    >
      {[2, 1, 0].map((offset) => (
        <Image
          key={offset}
          source={CARD_BACK}
          style={[
            styles.cardImage,
            styles.pileCard,
            { width: cardWidth, height: cardHeight, top: -offset * 2, left: -offset * 1.5 },
          ]}
          contentFit="cover"
        />
      ))}
    </Animated.View>
  );
}

/** One beat's cards pulled from the pile, glow breathing, returned on unmount. */
function BeatCards({ beat, width, pile }: { beat: number; width: number; pile: Point }) {
  const reducedMotion = useReducedMotion();
  const spec = tutorialBeat(beat);
  const cardWidth = beatCardWidth(width);
  const cardHeight = cardWidth / CARD_ASPECT;
  // A strip of open felt under the pile, whatever the stage height.
  const fanY = pile.y + cardHeight + FAN_GAP;
  const stepX = cardWidth - 6;

  // One shared pulse so the whole fan breathes together.
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 0.7;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reducedMotion, pulse]);

  const bloomStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(pulse.value, [0, 1], [0.25, 0.95]),
    shadowRadius: interpolate(pulse.value, [0, 1], [6, 18]),
    elevation: interpolate(pulse.value, [0, 1], [3, 12]),
  }));

  return (
    <>
      {spec.ranks.map((rank, index) => {
        const suit = SUIT_CYCLE[index % SUIT_CYCLE.length];
        const x = width / 2 + (index - (spec.ranks.length - 1) / 2) * stepX;
        const dx = pile.x - x;
        const dy = pile.y - fanY;
        const glow = glowColor(rank);

        const entering = reducedMotion
          ? undefined
          : new Keyframe({
              0: { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }] },
              20: { opacity: 1, transform: [{ translateX: dx }, { translateY: dy }] },
              100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
            })
              .duration(PULL_MS)
              .delay(PULL_START_DELAY_MS + index * 90);
        const exiting = reducedMotion
          ? undefined
          : new Keyframe({
              0: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
              80: { opacity: 1, transform: [{ translateX: dx }, { translateY: dy }] },
              100: { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }] },
            })
              .duration(PULL_MS)
              .delay(index * 60);

        return (
          <Animated.View
            key={`${beat}-${rank}-${suit}`}
            entering={entering}
            exiting={exiting}
            style={[
              styles.beatCardWrap,
              { left: x - cardWidth / 2, top: fanY - cardHeight / 2 },
            ]}
          >
            <Animated.View style={[styles.bloom, { shadowColor: spec.color }, bloomStyle]}>
              <View style={[styles.beatCard, { width: cardWidth, height: cardHeight, borderColor: glow }]}>
                <Image
                  source={CARD_FACES.regular[suit][rank]}
                  style={styles.cardImage}
                  contentFit="cover"
                />
              </View>
            </Animated.View>
          </Animated.View>
        );
      })}

      {spec.badge ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.delay(PULL_START_DELAY_MS + 300)}
          style={[styles.badge, { borderColor: spec.color, top: fanY + cardHeight / 2 + spacing.md }]}
        >
          <Text style={[styles.badgeText, { color: spec.color }]}>{spec.badge}</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

function glowColor(rank: Rank): string {
  const value = hiLoValue(rank);
  if (value > 0) {
    return colors.trainingPlus;
  }
  if (value < 0) {
    return colors.trainingMinus;
  }
  return colors.trainingNeutral;
}

interface FlashTutorialPanelProps {
  readonly step: number;
  /** Button on the last beat — "Next" when the level's own slides follow. */
  readonly lastLabel?: string;
  readonly onNext: () => void;
  readonly onSkip: () => void;
}

/** Beat copy + Next / Skip under the felt. */
export function FlashTutorialPanel({
  step,
  lastLabel = 'Deal me in',
  onNext,
  onSkip,
}: FlashTutorialPanelProps) {
  const beat = tutorialBeat(step);
  return (
    <FlashPanel kicker={`HI-LO  ·  ${step + 1} OF ${TUTORIAL_STEPS}`}>
      <Text style={[styles.title, { color: beat.color }]}>{beat.title}</Text>
      <Text style={styles.body}>{beat.body}</Text>
      <View style={styles.actions}>
        <PrimaryButton label={step + 1 === TUTORIAL_STEPS ? lastLabel : 'Next'} onPress={onNext} />
        <Text style={styles.skip} onPress={onSkip} accessibilityRole="button">
          Skip
        </Text>
      </View>
    </FlashPanel>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    minHeight: 0,
  },
  spreadSlot: {
    position: 'absolute',
  },
  spreadCard: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  pile: {
    position: 'absolute',
  },
  pileCard: {
    position: 'absolute',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  beatCardWrap: {
    position: 'absolute',
  },
  /** Pulsing colored bloom behind each card; the card keeps its own crisp outline. */
  bloom: {
    shadowOffset: { width: 0, height: 0 },
  },
  beatCard: {
    borderRadius: radii.sm,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
  },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    backgroundColor: colors.overlay,
  },
  badgeText: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skip: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
});
