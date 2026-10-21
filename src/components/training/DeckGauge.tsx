import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STACK_EDGE_TEXTURE } from '../../assets/registry';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import { useCardBack } from '../../hooks/useCardBack';
import { colors, fontWeights } from '../../theme';
import { CARD_ASPECT, cardCornerRadius } from '../game/PlayingCard';

/**
 * How far the cards lie back from the screen: the player looks down on the
 * tray from about 28°, enough to read the top card and the whole side.
 */
const TILT_DEG = 62;
const TILT = (TILT_DEG * Math.PI) / 180;
/** Camera distance in card widths, so every size is the same drawing. */
const PERSPECTIVE_WIDTHS = 8.5;
/** Clearance between the stack and the tray's side walls. */
const TRAY_GAP = 3;
const RIM = 1;
/** The low front wall of the tray, which hides the foot of the stack. */
const LIP_WALL = 3;
/** The tray's base plate under the floor. */
const BASE = 4;
/** A few cards in a discard pile sit a touch proud of the rest. */
const SLIPS: readonly { readonly at: number; readonly dx: number }[] = [
  { at: 0.22, dx: 1 },
  { at: 0.58, dx: -1 },
];
const SLIP_MIN_STACK = 16;

interface DeckGaugeProps {
  readonly variant: 'shoe' | 'discard';
  /** Cards in this pile. */
  readonly count: number;
  /** Cards the whole shoe started with — sets the scale. */
  readonly totalCards: number;
  /** Faint tick per deck — the crutch the deck-estimation ladder takes away. */
  readonly showScale: boolean;
  readonly label?: string;
  /** Width of a card's front edge; the whole drawing scales from it. */
  readonly cardWidth?: number;
  /** How tall a full shoe stands. */
  readonly trayHeight?: number;
}

/** Where the tilted top card lands on screen, from the card width alone. */
function geometry(cardWidth: number) {
  const cardHeight = cardWidth / CARD_ASPECT;
  const perspective = cardWidth * PERSPECTIVE_WIDTHS;
  // The near edge swings toward the eye by this much, the far edge away.
  const lift = (cardHeight / 2) * Math.sin(TILT);
  const nearScale = perspective / (perspective - lift);
  const farScale = perspective / (perspective + lift);
  const halfDepth = (cardHeight / 2) * Math.cos(TILT);
  return {
    cardHeight,
    perspective,
    /** The near edge's width — the stack's front face must match it. */
    near: cardWidth * nearScale,
    /** The near edge sits this far below the card's layout centre. */
    nearDrop: halfDepth * nearScale,
    /** Near edge to far edge on screen. */
    topHeight: halfDepth * (nearScale + farScale),
  };
}

/**
 * A pile of cards drawn to scale in a tray, seen from the player's seat: the
 * casino's card back lying on top, the cream side of the stack under it with
 * every card's edge in it, the clear acrylic of the discard tray or the gilt
 * housing of the shoe around it. The height of the stack is proportional to
 * the number of cards — exactly what a counter reads off the discard tray to
 * estimate the decks left. Never prints a number.
 *
 * Nothing here animates: it is a dozen flat views and two images, laid out
 * once per item.
 */
export function DeckGauge({
  variant,
  count,
  totalCards,
  showScale,
  label,
  cardWidth = 38,
  trayHeight = 92,
}: DeckGaugeProps) {
  const cardBack = useCardBack();
  const g = geometry(cardWidth);
  const fraction = totalCards > 0 ? Math.max(0, Math.min(1, count / totalCards)) : 0;
  const stack = count > 0 ? Math.max(3, Math.round(fraction * trayHeight)) : 0;
  const decks = Math.floor(totalCards / CARDS_PER_DECK);
  const ticks = showScale
    ? Array.from({ length: Math.max(0, decks - 1) }, (_, index) => (index + 1) / decks)
    : [];

  const trayWidth = Math.round(g.near) + 2 * (TRAY_GAP + RIM);
  const faceLeft = (trayWidth - g.near) / 2;
  /** The near edge of the tray floor, where the front of the stack stands. */
  const floorY = g.topHeight + trayHeight;
  const height = floorY + BASE;
  const faceTop = floorY - stack;
  const gilt = variant === 'shoe';
  const texture = decks >= 4 ? STACK_EDGE_TEXTURE.fine : STACK_EDGE_TEXTURE.coarse;
  const slips = variant === 'discard' && stack >= SLIP_MIN_STACK ? SLIPS : [];

  return (
    <View
      style={styles.column}
      accessibilityLabel={`${label ?? variant} pile, ${Math.round(fraction * 100)} percent full`}
    >
      <View style={{ width: trayWidth, height }}>
        {/* The tray: back wall, floor, and both side walls seen edge-on. */}
        <View
          style={[styles.wall, gilt ? styles.wallGilt : styles.wallClear, { height: trayHeight }]}
        />
        <View
          style={[
            styles.floor,
            gilt ? styles.floorGilt : styles.floorClear,
            { top: trayHeight, height: g.topHeight },
          ]}
        />
        <View style={[styles.rim, styles.rimLeft, gilt && styles.rimGilt, { height: floorY }]} />
        <View style={[styles.rim, styles.rimRight, gilt && styles.rimGilt, { height: floorY }]} />
        {ticks.map((tick) => (
          <View key={tick} style={[styles.tick, { top: Math.round(trayHeight * (1 - tick)) }]} />
        ))}

        {stack > 0 ? (
          <>
            {/* The side of the stack: cream card stock, lit from above, every edge in it. */}
            <View style={[styles.face, { left: faceLeft, top: faceTop, width: g.near, height: stack }]}>
              <LinearGradient
                colors={['#F8F1E1', '#EDE3CB', '#D2C4A5']}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
              />
              {/* The grain sheet is bigger than any face; the face crops it. */}
              <Image
                source={texture}
                style={StyleSheet.absoluteFill}
                contentFit="none"
                contentPosition="top left"
              />
            </View>
            {slips.map((slip) => (
              <View
                key={slip.at}
                style={[
                  styles.slip,
                  {
                    left: faceLeft + slip.dx,
                    top: floorY - Math.round(stack * slip.at),
                    width: g.near,
                  },
                ]}
              />
            ))}
            {/* The top card, lying flat: the casino's back, tilted away in perspective. */}
            <View
              style={[
                styles.top,
                {
                  left: (trayWidth - cardWidth) / 2,
                  top: faceTop - g.nearDrop - g.cardHeight / 2,
                  width: cardWidth,
                  height: g.cardHeight,
                  borderRadius: cardCornerRadius(cardWidth),
                  transform: [{ perspective: g.perspective }, { rotateX: `${TILT_DEG}deg` }],
                },
              ]}
            >
              <Image
                source={cardBack}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
              {/* Gloss: the far edge catches the light, the near edge turns away from it. */}
              <LinearGradient
                colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.14)']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </>
        ) : null}

        {/* The tray's front: a low wall over the foot of the stack, on a dark base. */}
        <View
          style={[
            styles.lipWall,
            gilt ? styles.lipWallGilt : styles.lipWallClear,
            { top: floorY - LIP_WALL, height: LIP_WALL },
          ]}
        />
        <View style={[styles.base, { top: floorY, height: BASE }]} />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: 4,
  },
  wall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
  },
  wallClear: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderTopColor: 'rgba(255, 255, 255, 0.42)',
  },
  wallGilt: {
    backgroundColor: 'rgba(242, 196, 69, 0.06)',
    borderTopColor: 'rgba(242, 196, 69, 0.55)',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  floorClear: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  floorGilt: {
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  rim: {
    position: 'absolute',
    top: 0,
    width: RIM,
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
  },
  rimLeft: {
    left: 0,
  },
  rimRight: {
    right: 0,
  },
  rimGilt: {
    backgroundColor: 'rgba(242, 196, 69, 0.4)',
  },
  tick: {
    position: 'absolute',
    left: -6,
    width: 6,
    height: 1,
    backgroundColor: colors.goldDim,
  },
  face: {
    position: 'absolute',
    overflow: 'hidden',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 1,
    borderColor: 'rgba(50, 35, 20, 0.42)',
  },
  slip: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#F3EAD8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(50, 35, 20, 0.5)',
  },
  top: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.35)',
    backgroundColor: '#F4EBD9',
  },
  lipWall: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  lipWallClear: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
  },
  lipWallGilt: {
    backgroundColor: 'rgba(242, 196, 69, 0.16)',
    borderTopColor: 'rgba(242, 196, 69, 0.7)',
  },
  base: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#15120F',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
});
