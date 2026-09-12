import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, fontWeights, spacing } from '../../theme';
import { ArcadeInset, ArcadeTab, arcadeText } from './ArcadePanel';

interface StarGoalsProps {
  /** The run that earns one, two and three stars. */
  readonly targets: readonly [number, number, number];
  /** "right" for streak levels, "checks" for checkpoints. */
  readonly unit: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** "STAR GOALS" tab over three tiles — ★ 11 right / ★★ 21 right / ★★★ 32 right. */
export function StarGoals({ targets, unit, style }: StarGoalsProps) {
  return (
    <View style={[styles.slot, style]}>
      <ArcadeTab label="Star goals" style={styles.tab} />
      <ArcadeInset style={styles.inset}>
        <View style={styles.tiles}>
          {targets.map((target, index) => (
            <View key={index} style={styles.tile}>
              <View style={styles.stars}>
                {Array.from({ length: index + 1 }, (_, star) => (
                  <Ionicons
                    key={star}
                    name="star"
                    size={STAR_SIZE}
                    color={colors.arcadeGold}
                    style={styles.star}
                  />
                ))}
              </View>
              <Text style={styles.target}>
                {target} {unit}
              </Text>
            </View>
          ))}
        </View>
        <Text style={arcadeText.caption}>Your best run determines your stars.</Text>
      </ArcadeInset>
    </View>
  );
}

const STAR_SIZE = 24;

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  /** The tab straddles the inset's top edge. */
  tab: {
    zIndex: 1,
    marginBottom: -(spacing.lg + spacing.xxs),
  },
  inset: {
    paddingTop: spacing.xl + spacing.sm,
    gap: spacing.sm,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: colors.arcadeFeltEdge,
    borderRadius: 16,
    backgroundColor: colors.arcadeTileFill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    height: STAR_SIZE + 4,
    alignItems: 'center',
  },
  star: {
    marginHorizontal: -1,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  target: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    color: colors.arcadeCream,
    fontVariant: ['tabular-nums'],
  },
});
