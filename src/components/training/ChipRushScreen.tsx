import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

interface ChipRushScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/** Placeholder until the ChipRush mini-game lands. */
export function ChipRushScreen({ mapId, level }: ChipRushScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>
        ChipRush — map {mapId}, level {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { color: colors.textPrimary },
});
