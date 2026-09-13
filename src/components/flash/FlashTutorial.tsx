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
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSettingsStore } from '../../stores/settingsStore';
import { CARD_ASPECT, cardCornerRadius, cardFrameHeight } from '../game/PlayingCard';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { ArcadeTutorialPanel } from '../arcade/ArcadeTutorialPanel';
import { PrimaryButton } from '../common/PrimaryButton';
import { FlashPanel } from './FlashPanel';

/**
 * Five-beat Hi-Lo primer, dealt from a real deck. While the table idles, all
 * 52 cards lie fanned in a ribbon across the felt. Begin sweeps them into one
 * pile at the dealer spot; each beat then pulls its cards out of the pile —
 * the value beats every card of their ranks, all four suits, laid out apart
 * in a grid over the house print; the betting beats a bunched hand of five
 * under it — lets them breathe their glow, and slides them back before the
 * next group comes out.
 */
export const TUTORIAL_STEPS = 5;

/** One half-breathe of the card glow. Calm, not a strobe. */
const PULSE_HALF_MS = 750;
const SPREAD_CARD_WIDTH = 32;
/** Hairline around the spread and pile cards; the art keeps its aspect inside it. */
const SPREAD_RING = 1;
/** Glow ring around a pulled card. */
const BEAT_RING = 2;
const COLLECT_MS = 420;
const PULL_MS = 420;
/** Beat cards wait for the pile to gather before they slide out. */
const PULL_START_DELAY_MS = 350;

/**
 * Deck geometry, top-down in points so the deck is the same size on any felt:
 * the pile sits just under the dealer's rail, the house print under it, and
 * each beat's cards are dealt out of the pile — the betting hand onto the
 * open felt below the print, a value grid over the print itself, right under
 * the pile — so the deck stays in view the whole time. The felt runs to the
 * foot of the tallest layout so nothing shifts between beats. The count flag
 * sits at the end of the dealt row on the betting beats.
 */
const PILE_TOP = spacing.md;
/** Open felt between the print's foot and the dealt cards, under the pile, and under them. */
const FAN_GAP = spacing.sm;
/** The dealt row is capped so the felt under the print still fits it on a 6.1" phone. */
const BEAT_CARD_MAX_WIDTH = 52;
/**
 * A value beat lays every card of its ranks out apart, hand-sized, in three
 * rows over the print — twenty cards go seven across, which just fits a
 * 6.1" phone between these insets; on anything narrower the cards give a
 * little. Each row is centred on the table's axis.
 */
const GRID_ROWS = 3;
const GRID_INSET = spacing.md;
const GRID_GAP = spacing.xs;
/** The betting beats bunch their cards — the count's worth of them, together — with the flag alongside. */
const BET_BEAT_OVERLAP = 6;
/** Per-card deal stagger, shortened so a 20-card grid lands in about the time a hand does. */
const PULL_STAGGER_MS = 90;
const PULL_STAGGER_BUDGET_MS = 900;
const RETURN_STAGGER_MS = 60;
const RETURN_STAGGER_BUDGET_MS = 600;
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

/** Pile and betting-beat cards read at one size: five across with room for the flag. */
function beatCardWidth(width: number): number {
  return Math.min((width - 72) / 5 - 4, BEAT_CARD_MAX_WIDTH);
}

/** Top edge of the betting hand: under the print, a strip of felt between. */
function handTop(letteringHeight: number): number {
  return SPREAD_DECK_BOTTOM + letteringHeight + FAN_GAP;
}

/** Top edge of a value grid: right under the pile, over the print. */
function gridTop(width: number): number {
  return PILE_TOP + cardFrameHeight(beatCardWidth(width), SPREAD_RING) + FAN_GAP;
}

/** Felt the primer wants: the deck's band, the house print, the tallest beat, a margin. */
export function tutorialStageHeight(letteringHeight: number, width: number): number {
  const foot = Math.max(...BEATS.map((_, step) => beatLayout(step, width, letteringHeight).bottom));
  return Math.round(foot + FAN_GAP);
}

interface TutorialBeat {
  readonly ranks: readonly Rank[];
  readonly title: string;
  readonly body: string;
  readonly color: string;
  /** Big count flag hung under the house print ("+7" / "−7"). */
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
    body: 'Small cards gone, tens and aces left. Blackjacks pay you — raise your bets.',
    color: colors.success,
    badge: '+7',
  },
  {
    // The high cards already dealt — they dragged the count down to −7.
    ranks: ['A', 'K', 'Q', 'J', '10'],
    title: 'Low count — bet small',
    body: 'High cards gone, small ones left. The house has the edge — bet the minimum.',
    color: colors.error,
    badge: '−7',
  },
];

const SUIT_CYCLE: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export function tutorialBeat(step: number): TutorialBeat {
  return BEATS[Math.min(Math.max(step, 0), BEATS.length - 1)];
}

/** Columns of the widest value grid: its twenty cards over the rows. */
const GRID_COLUMNS = Math.ceil(
  Math.max(...BEATS.filter((beat) => !beat.badge).map((beat) => beat.ranks.length)) *
    SUIT_CYCLE.length /
    GRID_ROWS,
);

/** Grid cards match the betting hand's, giving only when the widest grid would not fit. */
function gridCardWidth(width: number): number {
  return Math.min(
    (width - 2 * GRID_INSET - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS,
    BEAT_CARD_MAX_WIDTH,
  );
}

interface BeatSlot {
  readonly rank: Rank;
  readonly suit: Suit;
  /** Centre of the card on the felt. */
  readonly x: number;
  readonly y: number;
}

interface BeatLayout {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly slots: readonly BeatSlot[];
  /** Foot of the lowest card. */
  readonly bottom: number;
}

/**
 * Where a beat's cards land. A betting beat: one of each rank, bunched in a
 * row under the print. A value beat: every card of its ranks, rank by rank
 * with the suits alternating colour, laid out apart in centred rows over
 * the print.
 */
export function beatLayout(step: number, width: number, letteringHeight: number): BeatLayout {
  const spec = tutorialBeat(step);
  if (spec.badge) {
    const top = handTop(letteringHeight);
    const cardWidth = beatCardWidth(width);
    const cardHeight = cardFrameHeight(cardWidth, BEAT_RING);
    const stepX = cardWidth - BET_BEAT_OVERLAP;
    const slots = spec.ranks.map((rank, index) => ({
      rank,
      suit: SUIT_CYCLE[index % SUIT_CYCLE.length],
      x: width / 2 + (index - (spec.ranks.length - 1) / 2) * stepX,
      y: top + cardHeight / 2,
    }));
    return { cardWidth, cardHeight, slots, bottom: top + cardHeight };
  }
  const top = gridTop(width);
  const cardWidth = gridCardWidth(width);
  const cardHeight = cardFrameHeight(cardWidth, BEAT_RING);
  const cards = spec.ranks.flatMap((rank) => SUIT_CYCLE.map((suit) => ({ rank, suit })));
  const columns = Math.ceil(cards.length / GRID_ROWS);
  const slots = cards.map((card, index) => {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, cards.length - row * columns);
    return {
      ...card,
      x: width / 2 + ((index % columns) - (inRow - 1) / 2) * (cardWidth + GRID_GAP),
      y: top + row * (cardHeight + GRID_GAP) + cardHeight / 2,
    };
  });
  const rows = Math.ceil(cards.length / columns);
  return {
    cardWidth,
    cardHeight,
    slots,
    bottom: top + rows * cardHeight + (rows - 1) * GRID_GAP,
  };
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
  /** Felt the house print takes under the deck; the beats are dealt below it. */
  readonly letteringHeight: number;
}

/** The felt during idle and the tutorial: ribbon spread, pile, pulled beats. */
export function FlashTutorialDeck({
  beat,
  gathered = false,
  width,
  letteringHeight,
}: FlashTutorialDeckProps) {
  // The gathered deck reads at the same size as the cards pulled from it.
  const pileCardWidth = beatCardWidth(width);
  const pile: Point = { x: width / 2, y: PILE_TOP + pileCardWidth / CARD_ASPECT / 2 };
  const spread = beat === null && !gathered;

  return (
    <View style={styles.area}>
      {spread ? null : <DeckPile pile={pile} cardWidth={pileCardWidth} />}
      {spread ? <RibbonSpread width={width} pile={pile} /> : null}
      {beat !== null ? (
        <BeatCards
          key={beat}
          beat={beat}
          width={width}
          pile={pile}
          letteringHeight={letteringHeight}
        />
      ) : null}
    </View>
  );
}

/** All 52 cards face up in a gentle ribbon, fanned out of / collected into the pile. */
function RibbonSpread({ width, pile }: { width: number; pile: Point }) {
  const reducedMotion = useReducedMotion();
  const faces = CARD_FACES[useSettingsStore((state) => state.cardDeck)];
  const cards = useMemo(
    () => SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))),
    [],
  );
  const cardHeight = cardFrameHeight(SPREAD_CARD_WIDTH, SPREAD_RING);

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
            <View
              style={[
                styles.spreadCard,
                { borderRadius: cardCornerRadius(SPREAD_CARD_WIDTH), transform: [{ rotate }] },
              ]}
            >
              <Image source={faces[suit][rank]} style={styles.cardImage} contentFit="cover" />
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
  const cardHeight = cardFrameHeight(cardWidth, SPREAD_RING);
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
            {
              width: cardWidth,
              height: cardHeight,
              borderRadius: cardCornerRadius(cardWidth),
              top: -offset * 2,
              left: -offset * 1.5,
            },
          ]}
          contentFit="cover"
        />
      ))}
    </Animated.View>
  );
}

/** One beat's cards pulled from the pile, glow breathing, returned on unmount. */
function BeatCards({
  beat,
  width,
  pile,
  letteringHeight,
}: {
  beat: number;
  width: number;
  pile: Point;
  letteringHeight: number;
}) {
  const reducedMotion = useReducedMotion();
  const faces = CARD_FACES[useSettingsStore((state) => state.cardDeck)];
  const spec = tutorialBeat(beat);
  // Dealt from the pile onto the open felt under the house print.
  const { cardWidth, cardHeight, slots } = beatLayout(beat, width, letteringHeight);
  // The count flag sits just past the row's last card, on the same line.
  const last = slots[slots.length - 1];
  const flagLeft = last.x + cardWidth / 2 + spacing.md;
  const pullStagger = Math.min(PULL_STAGGER_MS, PULL_STAGGER_BUDGET_MS / slots.length);
  const returnStagger = Math.min(RETURN_STAGGER_MS, RETURN_STAGGER_BUDGET_MS / slots.length);

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
      {slots.map(({ rank, suit, x, y }, index) => {
        const dx = pile.x - x;
        const dy = pile.y - y;
        const glow = glowColor(rank);

        const entering = reducedMotion
          ? undefined
          : new Keyframe({
              0: { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }] },
              20: { opacity: 1, transform: [{ translateX: dx }, { translateY: dy }] },
              100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
            })
              .duration(PULL_MS)
              .delay(PULL_START_DELAY_MS + index * pullStagger);
        const exiting = reducedMotion
          ? undefined
          : new Keyframe({
              0: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
              80: { opacity: 1, transform: [{ translateX: dx }, { translateY: dy }] },
              100: { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }] },
            })
              .duration(PULL_MS)
              .delay(index * returnStagger);

        return (
          <Animated.View
            key={`${beat}-${rank}-${suit}`}
            entering={entering}
            exiting={exiting}
            style={[
              styles.beatCardWrap,
              { left: x - cardWidth / 2, top: y - cardHeight / 2 },
            ]}
          >
            <Animated.View style={[styles.bloom, { shadowColor: spec.color }, bloomStyle]}>
              <View
                style={[
                  styles.beatCard,
                  {
                    width: cardWidth,
                    height: cardHeight,
                    borderRadius: cardCornerRadius(cardWidth),
                    borderColor: glow,
                  },
                ]}
              >
                <Image
                  source={faces[suit][rank]}
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
          style={[
            styles.flagSlot,
            { left: flagLeft, top: last.y - cardHeight / 2, height: cardHeight },
          ]}
        >
          <View style={[styles.badge, { borderColor: spec.color }]}>
            <Text style={[styles.badgeText, { color: spec.color }]}>{spec.badge}</Text>
          </View>
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
  const modern = useModernUi();
  const beat = tutorialBeat(step);
  const nextLabel = step + 1 === TUTORIAL_STEPS ? lastLabel : 'Next';
  if (modern) {
    return (
      <ArcadeTutorialPanel
        kicker="Hi-Lo"
        progress={`${step + 1} of ${TUTORIAL_STEPS}`}
        title={beat.title}
        titleColor={beat.color}
        body={beat.body}
        nextLabel={nextLabel}
        onNext={onNext}
        onSkip={onSkip}
      />
    );
  }
  return (
    <FlashPanel kicker={`HI-LO  ·  ${step + 1} OF ${TUTORIAL_STEPS}`}>
      <Text style={[styles.title, { color: beat.color }]}>{beat.title}</Text>
      <Text style={styles.body}>{beat.body}</Text>
      <View style={styles.actions}>
        <PrimaryButton label={nextLabel} onPress={onNext} />
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
    borderWidth: SPREAD_RING,
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
    borderWidth: SPREAD_RING,
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
    borderWidth: BEAT_RING,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
  },
  /** A card-tall slot past the dealt row; the flag floats mid-card in it. */
  flagSlot: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  badge: {
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
