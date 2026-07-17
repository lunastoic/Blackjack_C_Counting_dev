import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CHIP_SETS } from '../../assets/registry';
import { playSound } from '../../services/audio';
import { useEconomyStore } from '../../stores/economyStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';
import { PressableScale } from '../common/PressableScale';

const CHIP_SIZE = 56;

/** 2500 → "2.5K", 10000 → "10K" for high-denomination trays. */
function formatChipShort(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  const thousands = value / 1000;
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
}

/** Tap-to-bet chip row using the map's denominations and themed chip art. */
export function ChipTray() {
  const map = useGameSessionStore((state) => state.map);
  const wager = useGameSessionStore((state) => state.wager);
  const addChipToBet = useGameSessionStore((state) => state.addChipToBet);
  const chips = useEconomyStore((state) => state.chips);

  if (!map) {
    return null;
  }

  const chipSet = CHIP_SETS[map.chipSetKey] ?? CHIP_SETS.default;

  return (
    <View style={styles.tray}>
      {map.chipDenominations.map((value) => {
        const affordable = chips >= value && wager + value <= map.maxBet;
        const image = chipSet[value];
        return (
          <PressableScale
            key={value}
            disabled={!affordable}
            accessibilityLabel={`Bet ${value} chip`}
            accessibilityState={{ disabled: !affordable }}
            onPress={() => {
              if (addChipToBet(value)) {
                playSound('chipTap');
              }
            }}
            style={[styles.chip, !affordable && styles.chipDisabled]}
          >
            <View style={styles.chipFace}>
              {image != null ? (
                <Image source={image} style={styles.chipImage} resizeMode="contain" />
              ) : (
                <View style={styles.chipFallback}>
                  <Text style={styles.chipFallbackText}>{formatChipShort(value)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.chipValue}>{formatChipShort(value)}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.sm,
    minHeight: CHIP_SIZE + 18,
  },
  chip: {
    width: CHIP_SIZE,
    alignItems: 'center',
    gap: 2,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipFace: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipImage: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
  },
  chipValue: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
  chipFallback: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: CHIP_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFallbackText: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
});
