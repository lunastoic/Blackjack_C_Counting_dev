import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

interface SwipeStrategyScreenProps {
  readonly mapId: number;
  readonly level: number;
}

/** Placeholder until the SwipeStrategy mini-game lands. */
export function SwipeStrategyScreen({ mapId, level }: SwipeStrategyScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>
        SwipeStrategy — map {mapId}, level {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { color: colors.textPrimary },
});
