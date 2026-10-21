import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../../theme';

const STAR_SIZE = 26;
/** Each star's tap target, wider than the glyph. */
const HIT = 40;
const BUBBLE_WIDTH = 236;
const BUBBLE_GAP = 10;
const POINTER = 12;
const SCREEN_MARGIN = 12;
/** Flip the bubble above the star when less than this is left below it. */
const ROOM_BELOW = 170;

interface StarBadgesProps {
  /** The run that earns one, two and three stars. */
  readonly targets: readonly [number, number, number];
  /** "right" for streak levels, "checks" for checkpoints. */
  readonly unit: string;
  /** Says each star's goal in full instead of "target unit" — a shoe run's "finish / 80% right / 100% right". */
  readonly labels?: readonly [string, string, string];
  /** The player's best run, "27 right · combo 12". */
  readonly best?: string;
  /** Stars already banked on this level, 0–3. */
  readonly earned?: number;
}

interface OpenStar {
  readonly index: number;
  /** The tapped star's frame in window coordinates. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function StarGlyph({ lit }: { readonly lit: boolean }) {
  return (
    <Ionicons
      name={lit ? 'star' : 'star-outline'}
      size={STAR_SIZE}
      color={colors.arcadeGold}
      style={[styles.glyph, !lit && styles.glyphUnlit]}
    />
  );
}

/**
 * The level's three stars on the plaque, under the title: the ones the player
 * has banked lit, the rest outlined. Tapping a star pops its goal out over
 * everything else on the screen — the star stays lit on top of the scrim and
 * the bubble hangs off it — so the brief itself carries no star-goal copy.
 */
export function StarBadges({ targets, unit, labels, best, earned = 0 }: StarBadgesProps) {
  const refs = [useRef<View>(null), useRef<View>(null), useRef<View>(null)];
  const [open, setOpen] = useState<OpenStar | null>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const goalFor = (index: number) => (labels ? labels[index] : `${targets[index]} ${unit}`);
  const close = () => setOpen(null);
  const show = (index: number) => {
    refs[index].current?.measureInWindow((x, y, width, height) => {
      setOpen({ index, x, y, width, height });
    });
  };

  let bubble: React.ReactNode = null;
  if (open) {
    const starCenter = open.x + open.width / 2;
    const left = Math.min(
      Math.max(SCREEN_MARGIN, starCenter - BUBBLE_WIDTH / 2),
      screenWidth - SCREEN_MARGIN - BUBBLE_WIDTH,
    );
    const below = screenHeight - (open.y + open.height) >= ROOM_BELOW;
    const lit = open.index < earned;
    bubble = (
      <View
        pointerEvents="none"
        style={[
          styles.bubble,
          { left },
          below
            ? { top: open.y + open.height + BUBBLE_GAP }
            : { bottom: screenHeight - open.y + BUBBLE_GAP },
        ]}
      >
        <View
          style={[
            styles.pointer,
            { left: starCenter - left - POINTER / 2 },
            below ? styles.pointerUp : styles.pointerDown,
          ]}
        />
        <View style={styles.bubbleStars}>
          {Array.from({ length: open.index + 1 }, (_, star) => (
            <Ionicons key={star} name="star" size={18} color={colors.arcadeGold} style={styles.glyph} />
          ))}
        </View>
        <Text style={styles.goal}>{goalFor(open.index).toUpperCase()}</Text>
        <Text style={styles.caption}>
          {lit ? 'Banked — your best run got here.' : 'In one run, for this star.'}
        </Text>
        {best ? (
          <Text style={styles.best}>
            Best so far <Text style={styles.bestValue}>{best}</Text>
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {targets.map((_, index) => (
        <Pressable
          key={index}
          ref={refs[index]}
          onPress={() => show(index)}
          accessibilityRole="button"
          accessibilityLabel={`${index + 1} star${index > 0 ? 's' : ''}: ${goalFor(index)}`}
          accessibilityHint="Shows what this star takes"
          style={({ pressed }) => [styles.hit, pressed && styles.hitPressed]}
        >
          <StarGlyph lit={index < earned} />
        </Pressable>
      ))}

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        {open ? (
          <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Dismiss">
            {/* The tapped star, drawn again over the scrim exactly where it sits. */}
            <View
              pointerEvents="none"
              style={[
                styles.starClone,
                { left: open.x, top: open.y, width: open.width, height: open.height },
              ]}
            >
              <StarGlyph lit={open.index < earned} />
            </View>
            {bubble}
          </Pressable>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -spacing.xxs,
  },
  hit: {
    width: HIT,
    height: HIT - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitPressed: {
    transform: [{ scale: 0.9 }],
  },
  glyph: {
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  glyphUnlit: {
    opacity: 0.55,
    textShadowColor: 'transparent',
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(8, 6, 10, 0.72)',
  },
  starClone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm + spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
    backgroundColor: colors.arcadePlaque,
    boxShadow: `0px 4px 0px ${colors.arcadeInk}`,
  },
  pointer: {
    position: 'absolute',
    width: POINTER,
    height: POINTER,
    backgroundColor: colors.arcadePlaque,
    borderColor: colors.arcadeInk,
    transform: [{ rotate: '45deg' }],
  },
  pointerUp: {
    top: -POINTER / 2 - 2,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  pointerDown: {
    bottom: -POINTER / 2 - 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  bubbleStars: {
    flexDirection: 'row',
    gap: 1,
  },
  goal: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: 1,
    color: colors.arcadeGold,
    textAlign: 'center',
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    lineHeight: fontSizes.caption + 6,
    color: colors.arcadeCream,
    textAlign: 'center',
  },
  best: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption,
    lineHeight: fontSizes.caption + 5,
    color: colors.arcadeMuted,
    textAlign: 'center',
  },
  bestValue: {
    color: colors.arcadeGold,
  },
});
