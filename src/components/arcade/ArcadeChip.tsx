import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../../theme';

/**
 * The Modern look's chip, drawn in code in the same bevel as the buttons:
 * ink outline, edge dashes, an inner ring with a deeper band, a gold crescent
 * behind the denomination and the number in ink with a white hairline. The
 * PNG sets stay for the Classic look.
 */

interface ChipPalette {
  readonly face: string;
  readonly deep: string;
  readonly dash: string;
}

const PALETTES: Readonly<Record<number, ChipPalette>> = {
  1: { face: colors.arcadeChipCream, deep: colors.arcadeChipCreamDeep, dash: colors.arcadeChipCreamDash },
  5: { face: colors.arcadeOrange, deep: colors.arcadeOrangeDeep, dash: colors.arcadeCream },
  25: { face: colors.arcadeGreen, deep: colors.arcadeGreenDeep, dash: colors.arcadeCream },
  50: { face: colors.arcadeChipMagenta, deep: colors.arcadeChipMagentaDeep, dash: colors.arcadeCream },
  100: { face: colors.arcadeBlue, deep: colors.arcadeBlueDeep, dash: colors.arcadeCream },
};
const FALLBACK: ChipPalette = {
  face: colors.arcadeNeutral,
  deep: colors.arcadeNeutralDeep,
  dash: colors.arcadeGold,
};

const OUTLINE = 3;
const INNER_OUTLINE = 2;
/** The face sits this far proud of its ink base. */
export const ARCADE_CHIP_DROP = 4;
const DASH_COUNT = 8;
const DASH_DEGREES = 22;
/** The eight offsets that stroke the number's white hairline. */
const HAIRLINE: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export interface ArcadeChipProps {
  readonly value: number;
  /** Diameter of the face; the ink drop adds to the height. */
  readonly size?: number;
  /** Drop the soft shadow (chips in a stack sit tight on their ink base). */
  readonly flat?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function ArcadeChip({ value, size = 56, flat = false, style }: ArcadeChipProps) {
  const palette = PALETTES[value] ?? FALLBACK;
  const radius = size / 2;
  // The inner circle sits `inset` in from the outline, and the crescent fills
  // it flush to its own ring.
  const inset = size * 0.15;
  const innerSize = size - OUTLINE * 2 - inset * 2;
  // Dashes span the ring between the inner circle and the outline, overrunning
  // both so the circles cover their ends.
  const ringOuter = radius - OUTLINE;
  const ringInner = innerSize / 2;
  const ringMid = (ringOuter + ringInner) / 2;
  const dashWidth = 2 * ringOuter * Math.sin((DASH_DEGREES / 2) * (Math.PI / 180));
  const dashHeight = ringOuter - ringInner + 6;
  const crescentRadius = innerSize / 2 - INNER_OUTLINE;
  const biteRadius = crescentRadius * 0.82;
  const fontSize = Math.round(size * 0.46);
  const label = String(value);

  return (
    <View style={[{ width: size, height: size + ARCADE_CHIP_DROP }, !flat && styles.shadow, style]}>
      <View style={[styles.base, { top: ARCADE_CHIP_DROP, borderRadius: radius }]} />
      <View style={[styles.face, { width: size, height: size, borderRadius: radius, backgroundColor: palette.face }]}>
        {Array.from({ length: DASH_COUNT }, (_, index) => {
          const angle = (index * 360) / DASH_COUNT;
          const theta = (angle * Math.PI) / 180;
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                width: dashWidth,
                height: dashHeight,
                left: radius - OUTLINE + ringMid * Math.cos(theta) - dashWidth / 2,
                top: radius - OUTLINE + ringMid * Math.sin(theta) - dashHeight / 2,
                backgroundColor: palette.dash,
                transform: [{ rotate: `${angle + 90}deg` }],
              }}
            />
          );
        })}
        <View
          style={[
            styles.inner,
            {
              top: inset,
              left: inset,
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              backgroundColor: palette.face,
            },
          ]}
        >
          <View style={styles.highlight} />
          <View style={[styles.band, { backgroundColor: palette.deep }]} />
          <View
            style={[
              styles.crescent,
              {
                width: crescentRadius * 2,
                height: crescentRadius * 2,
                borderRadius: crescentRadius,
                top: innerSize / 2 - INNER_OUTLINE - crescentRadius,
                left: innerSize / 2 - INNER_OUTLINE - crescentRadius,
              },
            ]}
          >
            <LinearGradient
              colors={[colors.arcadeCrescentLight, colors.arcadeCrescent, colors.arcadeCrescentDeep]}
              locations={[0, 0.45, 1]}
              start={{ x: 0.2, y: 0.2 }}
              end={{ x: 0.9, y: 0.9 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View
            style={{
              position: 'absolute',
              width: biteRadius * 2,
              height: biteRadius * 2,
              borderRadius: biteRadius,
              top: innerSize / 2 - INNER_OUTLINE - biteRadius - crescentRadius * 0.27,
              left: innerSize / 2 - INNER_OUTLINE - biteRadius + crescentRadius * 0.36,
              backgroundColor: palette.face,
            }}
          />
        </View>
        {HAIRLINE.map(([dx, dy]) => (
          <Text
            key={`${dx},${dy}`}
            style={[
              styles.number,
              styles.hairline,
              { fontSize, transform: [{ translateX: dx }, { translateY: dy }] },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
        <Text style={[styles.number, { fontSize }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: colors.arcadeInk,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 6 },
  },
  base: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.arcadeInk,
  },
  face: {
    borderWidth: OUTLINE,
    borderColor: colors.arcadeInk,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    position: 'absolute',
    borderWidth: INNER_OUTLINE,
    borderColor: colors.arcadeInk,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.arcadeHighlight,
  },
  band: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  crescent: {
    position: 'absolute',
    overflow: 'hidden',
  },
  number: {
    position: 'absolute',
    fontFamily: fonts.display,
    color: colors.arcadeInkOnLight,
    includeFontPadding: false,
    paddingBottom: 2,
  },
  hairline: {
    color: colors.arcadeChipOutline,
  },
});
