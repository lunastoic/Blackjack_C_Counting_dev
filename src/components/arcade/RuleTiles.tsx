import { Ionicons } from '@expo/vector-icons';
import React, { ComponentProps } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, spacing } from '../../theme';
import { RuleIcon, RuleTile } from '../training/copy';

const ICONS: Readonly<Record<RuleIcon, ComponentProps<typeof Ionicons>['name']>> = {
  timer: 'stopwatch-outline',
  keypad: 'keypad-outline',
  players: 'people-outline',
  flame: 'flame-outline',
};

interface RuleTilesProps {
  readonly tiles: readonly RuleTile[];
  /** Fine print under the row. */
  readonly note?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The brief's rules as one row of stat tiles — "2 / MISSES ALLOWED",
 * "5–10 / CARDS A CHECK", a stopwatch for a timed answer — in the star
 * goals' tile language, a quarter of the height the pills took.
 */
export function RuleTiles({ tiles, note, style }: RuleTilesProps) {
  if (tiles.length === 0 && !note) {
    return null;
  }
  return (
    <View style={[styles.slot, style]}>
      {tiles.length > 0 ? (
        <View style={styles.row}>
          {tiles.map((tile) => (
            <View key={tile.label} style={styles.tile}>
              <View style={styles.valueBox}>
                {tile.icon ? (
                  <Ionicons name={ICONS[tile.icon]} size={ICON_SIZE} color={colors.arcadeGold} style={styles.icon} />
                ) : (
                  <Text style={styles.value} numberOfLines={1}>
                    {tile.value}
                  </Text>
                )}
              </View>
              <Text style={styles.label}>{tile.label.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const ICON_SIZE = 20;
const VALUE_HEIGHT = 22;

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: spacing.xs + spacing.xxs,
  },
  tile: {
    flex: 1,
    maxWidth: 118,
    alignItems: 'center',
    gap: 1,
    borderWidth: 1.5,
    borderColor: colors.arcadeInfoEdge,
    borderRadius: 12,
    backgroundColor: colors.arcadeInfoFill,
    paddingTop: spacing.xs + 1,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  valueBox: {
    height: VALUE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: VALUE_HEIGHT,
    letterSpacing: 0.5,
    color: colors.arcadeGold,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    includeFontPadding: false,
  },
  icon: {
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  label: {
    fontFamily: fonts.monoMedium,
    fontSize: 8.5,
    lineHeight: 10,
    letterSpacing: 0.3,
    color: colors.arcadeMuted,
    textAlign: 'center',
  },
  note: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    color: colors.arcadeMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xs + spacing.xxs,
  },
});
