import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors, fontWeights } from '../../theme';

/**
 * The lettering printed on a real blackjack layout: the house name and rules
 * arced around the dealer — concave toward the dealer, so the curve of each
 * line faces down and matches the dealer's card ribbon. Pure Views: each
 * character sits on a circle whose centre is above the felt.
 *
 * By default the block fits itself to whatever box it is given: it measures
 * its parent, shrinks the type until all three lines fit, and centres the
 * block vertically — so the cards never land on the lettering, whatever the
 * phone. Pass `anchor` to pin the title at a fraction of the height instead
 * (full-stage overlays that manage their own clearance); the type then only
 * shrinks to clear the side insets.
 */

interface ArcLine {
  readonly text: string;
  readonly size: number;
  readonly weight: '600' | '800';
  readonly opacity: number;
}

interface FeltMarkingsProps {
  readonly casinoName: string;
  /**
   * Bottom of the title arc, as a fraction of the available height. When set,
   * the lettering is pinned there (shrinking only for `sideInset`) instead of
   * fitting the box.
   */
  readonly anchor?: number;
  /** Keep the arcs this far clear of each side (things parked on the rails). */
  readonly sideInset?: number;
  /**
   * Where the fitted block sits in its box: centred, or hugging the top so the
   * lettering reads as printed just below the dealer's ribbon. Ignored when
   * `anchor` is set.
   */
  readonly align?: 'center' | 'top';
}

/** Average glyph advance relative to font size for the system font. */
const GLYPH_ADVANCE = 0.62;
/** Baseline-to-baseline distance between lines at full size. */
const LINE_GAP = 34;
/** Glyph box sits this far above its arc point, as a fraction of its size. */
const GLYPH_RISE = 0.65;
/** Glyph box height as a fraction of font size. */
const GLYPH_BOX = 1.2;
const TITLE_SIZE = 26;
const RULE_SIZE = 15;
const FINE_SIZE = 12;
/** Never shrink below this; hide the lettering instead. */
const MIN_SCALE = 0.55;
/** Breathing room above and below the block. */
const BLOCK_MARGIN = 6;

const RULE_TEXT = 'Blackjack pays 3 to 2';
const FINE_TEXT = 'Dealer must stand on soft 17';

/** Half the angle an arc of `chars` glyphs of `size` sweeps on `radius`. */
function halfSpan(chars: number, size: number, radius: number): number {
  return (((chars - 1) / 2) * size * GLYPH_ADVANCE) / radius;
}

/** How far the ends of an arc rise above its centre. */
function arcRise(chars: number, size: number, radius: number): number {
  return radius * (1 - Math.cos(halfSpan(chars, size, radius)));
}

/** Width of an arc from the outer edge of its first glyph to its last. */
function arcExtent(chars: number, size: number, radius: number): number {
  return 2 * radius * Math.sin(halfSpan(chars, size, radius)) + size;
}

/** Height of the three-line block from the title's raised ends to the last line's foot. */
function blockHeight(nameChars: number, radius: number, scale: number): number {
  const title = TITLE_SIZE * scale;
  const fine = FINE_SIZE * scale;
  return (
    arcRise(nameChars, title, radius) +
    title * GLYPH_RISE +
    2 * LINE_GAP * scale +
    fine * (GLYPH_BOX - GLYPH_RISE)
  );
}

/** Widest of the three arcs at this scale. */
function blockWidth(nameChars: number, radius: number, scale: number): number {
  return Math.max(
    arcExtent(nameChars, TITLE_SIZE * scale, radius),
    arcExtent(RULE_TEXT.length, RULE_SIZE * scale, radius + LINE_GAP * scale),
    arcExtent(FINE_TEXT.length, FINE_SIZE * scale, radius + 2 * LINE_GAP * scale),
  );
}

/**
 * Largest scale (≤ 1) whose block fits the box; 0 when even MIN_SCALE won't.
 * An infinite height fits the width alone (anchored lettering).
 */
function fitScale(nameChars: number, radius: number, width: number, height: number): number {
  const room = height - BLOCK_MARGIN * 2;
  const fits = (scale: number) =>
    blockHeight(nameChars, radius, scale) <= room && blockWidth(nameChars, radius, scale) <= width;
  if (room <= 0 || !fits(MIN_SCALE)) {
    return 0;
  }
  if (fits(1)) {
    return 1;
  }
  // Both dimensions grow with scale — bisect.
  let low = MIN_SCALE;
  let high = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    if (fits(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

export function FeltMarkings({
  casinoName,
  anchor,
  sideInset = 0,
  align = 'center',
}: FeltMarkingsProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width: Math.floor(width), height: Math.floor(height) });
  }

  const baseRadius = size.width * 0.72;
  const nameChars = casinoName.length;
  const scale =
    size.width <= 0
      ? 0
      : fitScale(
          nameChars,
          baseRadius,
          size.width - 2 * sideInset,
          anchor !== undefined ? Number.POSITIVE_INFINITY : size.height,
        );

  const lines: ArcLine[] = [
    { text: casinoName, size: TITLE_SIZE * scale, weight: '800', opacity: 0.4 },
    { text: RULE_TEXT, size: RULE_SIZE * scale, weight: '600', opacity: 0.34 },
    { text: FINE_TEXT, size: FINE_SIZE * scale, weight: '600', opacity: 0.3 },
  ];

  const cx = size.width / 2;
  // Title arc point: pinned by `anchor`, or the block's top edge (centred, or
  // hugging the top margin) plus the arc's raised ends and the glyph box
  // hanging above the arc.
  const blockTop =
    align === 'top'
      ? BLOCK_MARGIN
      : (size.height - blockHeight(nameChars, baseRadius, scale)) / 2;
  const titleY =
    anchor !== undefined
      ? size.height * anchor
      : blockTop +
        arcRise(nameChars, TITLE_SIZE * scale, baseRadius) +
        TITLE_SIZE * scale * GLYPH_RISE;
  // Shared circle centre above the felt: every line curves around the dealer.
  const centerY = titleY - baseRadius;

  return (
    <View style={styles.overlay} pointerEvents="none" onLayout={onLayout}>
      {scale > 0
        ? lines.map((line, lineIndex) => {
            const radius = baseRadius + lineIndex * LINE_GAP * scale;
            const chars = line.text.split('');
            const anglePerChar = (line.size * GLYPH_ADVANCE) / radius;
            return chars.map((char, charIndex) => {
              if (char === ' ') {
                return null;
              }
              const phi = (charIndex - (chars.length - 1) / 2) * anglePerChar;
              const x = cx + radius * Math.sin(phi);
              const y = centerY + radius * Math.cos(phi);
              return (
                <Text
                  key={`${lineIndex}-${charIndex}`}
                  style={[
                    styles.char,
                    {
                      left: x - line.size / 2,
                      top: y - line.size * GLYPH_RISE,
                      fontSize: line.size,
                      fontWeight: line.weight === '800' ? fontWeights.heavy : fontWeights.semibold,
                      opacity: line.opacity,
                      width: line.size,
                      transform: [{ rotate: `${-phi}rad` }],
                    },
                  ]}
                >
                  {char}
                </Text>
              );
            });
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  char: {
    position: 'absolute',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
